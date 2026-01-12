import dotenv from "dotenv";
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

dotenv.config();

function parseArgs(argv) {
  const out = { mode: "full", strict: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--mode=")) out.mode = arg.split("=", 2)[1];
    if (arg === "--smoke") out.mode = "smoke";
    if (arg === "--full") out.mode = "full";
    if (arg === "--contract") out.mode = "contract";
    if (arg === "--strict") out.strict = true;
  }
  if (!["contract", "smoke", "full"].includes(out.mode)) {
    throw new Error(`Invalid --mode. Use contract|smoke|full (got: ${out.mode})`);
  }
  return out;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function env(name) {
  return process.env[name];
}

function envOptionalTrimmed(name) {
  const v = env(name);
  if (v == null) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
}

function requireEnv(names, context) {
  const missing = names.filter((n) => !env(n));
  if (missing.length) {
    const suffix = context ? ` (${context})` : "";
    throw new Error(
      `Missing env var(s)${suffix}: ${missing.join(", ")}. Copy env.example -> .env and fill your credentials.`
    );
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForHealth(baseUrl, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  throw new Error(`Server did not become healthy in ${timeoutMs}ms (${baseUrl}/health)`);
}

function randomId(prefix) {
  const now = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${now}_${rnd}`;
}

function generateCpf() {
  // Generates a syntactically valid CPF (11 digits) with check digits.
  const digits = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const calc = (base) => {
    const sum = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d10 = calc(digits);
  const d11 = calc([...digits, d10]);
  return [...digits, d10, d11].join("");
}

function onlyDigits(v) {
  return String(v ?? "").replace(/\D+/g, "");
}

function isValidCpf(v) {
  const cpf = onlyDigits(v);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const nums = cpf.split("").map((c) => Number(c));
  const calc = (len) => {
    const sum = nums.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d10 = calc(9);
  const d11 = calc(10);
  return nums[9] === d10 && nums[10] === d11;
}

function pickStringValueByPrefix(obj, prefix) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const v of Object.values(obj)) {
    if (typeof v === "string" && v.startsWith(prefix)) return v;
  }
  return undefined;
}

function extractPagarmeRecipients(listResult) {
  if (!listResult) return [];
  if (Array.isArray(listResult)) return listResult;
  if (Array.isArray(listResult.data)) return listResult.data;
  if (Array.isArray(listResult.recipients)) return listResult.recipients;
  if (Array.isArray(listResult.result?.data)) return listResult.result.data;
  if (Array.isArray(listResult.result)) return listResult.result;
  return [];
}

function logStep(title) {
  process.stdout.write(`\n=== ${title} ===\n`);
}

async function callTool(client, name, args) {
  let result;
  try {
    result = await client.callTool({ name, arguments: args ?? {} });
  } catch (err) {
    throw new Error(`${name} transport/call error: ${err?.message ?? String(err)}`);
  }

  if (result.isError) {
    const content =
      result.content?.map((c) => {
        if (c && typeof c === "object" && "type" in c && c.type === "text" && "text" in c) {
          return c.text;
        }
        return JSON.stringify(c);
      }) ?? [];
    const msg = content.join("\n").trim();
    throw new Error(`${name} failed: ${msg || JSON.stringify(result)}`);
  }

  return result.structuredContent ?? null;
}

async function runSmoke(client) {
  const errors = [];

  logStep("SMOKE: listTools");
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name);

  // Basic presence checks (ensures both integrations are registered)
  assert(names.includes("pagarme_get_recipients"), "Missing pagarme_get_recipients tool");
  assert(names.includes("woovi_list_charges"), "Missing woovi_list_charges tool");

  logStep("SMOKE: Pagar.me read-only");
  try {
    requireEnv(["PAGARME_API_KEY"], "Pagar.me");
    await callTool(client, "pagarme_get_recipients", { page: 1, size: 1 });
  } catch (e) {
    errors.push(e);
  }

  logStep("SMOKE: Woovi read-only");
  try {
    requireEnv(["WOOVI_APP_ID"], "Woovi");
    await callTool(client, "woovi_list_charges", {});
    await callTool(client, "woovi_list_refunds", {});
  } catch (e) {
    errors.push(e);
  }

  logStep("SMOKE: Woovi webhook HMAC (local)");
  try {
    // deterministic known example (we only validate that the tool runs)
    await callTool(client, "woovi_verify_webhook_hmac", {
      secret: "secret",
      signature: "XHf3l3u7B1Y3V3Zs9H6v7w+R9c8=",
      body: '{"event":"OPENPIX:CHARGE_COMPLETED"}',
      algorithm: "sha1",
    });
  } catch (e) {
    errors.push(e);
  }

  if (errors.length) {
    const msg = errors
      .map((e) => (e && typeof e === "object" && "message" in e ? e.message : String(e)))
      .join("\n");
    throw new Error(msg);
  }
}

async function runContract(client) {
  logStep("CONTRACT: listTools");
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name);

  // Presence checks: ensure both integrations are registered (no external calls).
  const required = [
    "pagarme_get_recipients",
    "pagarme_create_order_pix_split",
    "woovi_list_charges",
    "woovi_create_charge",
    "woovi_verify_webhook_hmac",
  ];
  for (const t of required) assert(names.includes(t), `Missing tool: ${t}`);

  logStep("CONTRACT: Woovi webhook HMAC (local tool)");
  // Validate that local tool runs and returns a boolean.
  const out = await callTool(client, "woovi_verify_webhook_hmac", {
    secret: "secret",
    signature: "XHf3l3u7B1Y3V3Zs9H6v7w+R9c8=",
    body: '{"event":"OPENPIX:CHARGE_COMPLETED"}',
    algorithm: "sha1",
  });
  assert(typeof out?.valid === "boolean", "Expected woovi_verify_webhook_hmac to return { valid: boolean }");
}

async function runFull(client, opts) {
  logStep("FULL: listTools");
  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name);

  const requiredTools = [
    // pagarme
    "pagarme_create_customer",
    "pagarme_get_customer",
    "pagarme_update_customer_metadata",
    "pagarme_create_recipient",
    "pagarme_get_recipients",
    "pagarme_create_card_token",
    "pagarme_get_token",
    "pagarme_create_order_pix_split",
    "pagarme_get_order",
    "pagarme_get_charge",
    "pagarme_cancel_charge",
    // woovi
    "woovi_create_charge",
    "woovi_get_charge",
    "woovi_list_charges",
    "woovi_delete_charge",
    "woovi_list_refunds",
    "woovi_verify_webhook_hmac",
  ];
  for (const t of requiredTools) assert(names.includes(t), `Missing tool: ${t}`);

  requireEnv(["PAGARME_API_KEY", "WOOVI_APP_ID"], "full e2e");

  // --- Woovi flow (create -> get -> list -> delete)
  logStep("FULL: Woovi - create/get/list/delete charge");
  const wooviCorrelation = randomId("e2e_woovi");
  const wooviCustomerTaxIdRaw =
    env("E2E_WOOVI_CUSTOMER_TAXID") ?? env("E2E_WOOVI_CUSTOMER_TAX_ID") ?? generateCpf();
  const wooviCustomerTaxId = isValidCpf(wooviCustomerTaxIdRaw) ? onlyDigits(wooviCustomerTaxIdRaw) : generateCpf();
  const wooviCustomerEmail = env("E2E_WOOVI_CUSTOMER_EMAIL") ?? `e2e+${randomId("woovi")}@example.com`;
  const wooviCustomerPhone = env("E2E_WOOVI_CUSTOMER_PHONE") ?? "+5511999999999";

  const wooviCreate = await callTool(client, "woovi_create_charge", {
    correlationID: wooviCorrelation,
    value: 100, // cents
    comment: "E2E test charge",
    customer: {
      name: "E2E Test",
      email: wooviCustomerEmail,
      phone: wooviCustomerPhone,
      taxID: wooviCustomerTaxId,
    },
  });

  const wooviId =
    wooviCreate?.charge?.correlationID ||
    wooviCreate?.charge?.identifier ||
    wooviCreate?.raw?.charge?.correlationID ||
    wooviCorrelation;

  await callTool(client, "woovi_get_charge", { id: wooviId });
  await callTool(client, "woovi_list_charges", { customer: undefined });
  await callTool(client, "woovi_delete_charge", { id: wooviId });
  await callTool(client, "woovi_list_refunds", {});

  logStep("FULL: Woovi - webhook HMAC (local)");
  await callTool(client, "woovi_verify_webhook_hmac", {
    secret: "secret",
    signature: "XHf3l3u7B1Y3V3Zs9H6v7w+R9c8=",
    body: '{"event":"OPENPIX:CHARGE_COMPLETED"}',
    algorithm: "sha1",
  });

  // --- Pagar.me flow
  logStep("FULL: Pagar.me - create/get/update customer");
  const customerDocRaw = env("E2E_PAGARME_CUSTOMER_DOCUMENT") ?? generateCpf();
  const customerDoc = isValidCpf(customerDocRaw) ? onlyDigits(customerDocRaw) : generateCpf();
  const customerEmail = env("E2E_PAGARME_CUSTOMER_EMAIL") ?? `e2e+${randomId("cust")}@example.com`;
  const pagarmeCustomerCode = randomId("e2e_customer");

  const customer = await callTool(client, "pagarme_create_customer", {
    name: env("E2E_PAGARME_CUSTOMER_NAME") ?? "E2E Customer",
    email: customerEmail,
    document: customerDoc,
    type: "individual",
    code: pagarmeCustomerCode,
    address: {
      street: "Rua Exemplo",
      number: "100",
      zipCode: "01001000",
      neighborhood: "Centro",
      city: "Sao Paulo",
      state: "SP",
      country: "BR",
    },
    idempotencyKey: randomId("pagarme_create_customer"),
  });

  const customerId = customer?.id;
  assert(customerId, "pagarme_create_customer did not return customer.id");
  await callTool(client, "pagarme_get_customer", { customerId });
  await callTool(client, "pagarme_update_customer_metadata", {
    customerId,
    metadata: { e2e: "true", run: randomId("run") },
    idempotencyKey: randomId("pagarme_update_customer_metadata"),
  });

  logStep("FULL: Pagar.me - create/update/list recipient");
  requireEnv(
    [
      "E2E_PAGARME_RECIPIENT_DOCUMENT",
      "E2E_PAGARME_RECIPIENT_EMAIL",
      "E2E_PAGARME_BANK_HOLDER_NAME",
      "E2E_PAGARME_BANK_HOLDER_TYPE",
      "E2E_PAGARME_BANK_HOLDER_DOCUMENT",
      "E2E_PAGARME_BANK_CODE",
      "E2E_PAGARME_BANK_BRANCH_NUMBER",
      "E2E_PAGARME_BANK_ACCOUNT_NUMBER",
      "E2E_PAGARME_BANK_ACCOUNT_CHECK_DIGIT",
      "E2E_PAGARME_BANK_ACCOUNT_TYPE",
    ],
    "Pagar.me recipient/bank account"
  );

  const recipient = await callTool(client, "pagarme_create_recipient", {
    name: env("E2E_PAGARME_RECIPIENT_NAME") ?? "E2E Recipient",
    email: env("E2E_PAGARME_RECIPIENT_EMAIL"),
    document: env("E2E_PAGARME_RECIPIENT_DOCUMENT"),
    type: "individual",
    code: randomId("e2e_recipient"),
    defaultBankAccount: {
      holderName: env("E2E_PAGARME_BANK_HOLDER_NAME"),
      holderType: env("E2E_PAGARME_BANK_HOLDER_TYPE"),
      holderDocument: env("E2E_PAGARME_BANK_HOLDER_DOCUMENT"),
      bank: env("E2E_PAGARME_BANK_CODE"),
      branchNumber: env("E2E_PAGARME_BANK_BRANCH_NUMBER"),
      branchCheckDigit: envOptionalTrimmed("E2E_PAGARME_BANK_BRANCH_CHECK_DIGIT"),
      accountNumber: env("E2E_PAGARME_BANK_ACCOUNT_NUMBER"),
      accountCheckDigit: env("E2E_PAGARME_BANK_ACCOUNT_CHECK_DIGIT"),
      type: env("E2E_PAGARME_BANK_ACCOUNT_TYPE"),
      pixKey: envOptionalTrimmed("E2E_PAGARME_BANK_PIX_KEY"),
    },
    idempotencyKey: randomId("pagarme_create_recipient"),
  });

  const recipientId = recipient?.id;
  assert(recipientId, "pagarme_create_recipient did not return recipient.id");

  // Print minimal info to help diagnose account constraints (avoid printing bank account numbers).
  process.stdout.write(
    `Created recipient info: ${JSON.stringify(
      {
        id: recipient?.id ?? null,
        code: recipient?.code ?? null,
        status: recipient?.status ?? null,
        registerInformationStatus:
          recipient?.registerInformationStatus ??
          recipient?.register_information_status ??
          recipient?.registerInformation?.status ??
          null,
        gatewayRecipients:
          Array.isArray(recipient?.gatewayRecipients) && recipient.gatewayRecipients.length
            ? recipient.gatewayRecipients.map((g) => ({ id: g?.id ?? null, status: g?.status ?? null }))
            : null,
      },
      null,
      2
    )}\n`
  );

  // Give the gateway a moment to propagate rp_ id after creation.
  await sleep(2000);

  // Fetch recipients to find an existing active one for orders (more stable than using the newly-created recipient).
  const recipientsList = await callTool(client, "pagarme_get_recipients", { page: 1, size: 20 });
  const recipients = extractPagarmeRecipients(recipientsList);
  const activeRecipientFromList =
    recipients.find((r) => r?.status === "active" && typeof r?.id === "string")?.id ?? undefined;

  // Some responses may include multiple ids; prefer an id with rp_ prefix if present.
  const createdRecipientSplitId = pickStringValueByPrefix(recipient, "rp_") ?? recipientId;
  const orderRecipientId =
    envOptionalTrimmed("E2E_PAGARME_ORDER_RECIPIENT_ID") ??
    activeRecipientFromList ??
    createdRecipientSplitId;

  process.stdout.write(`Using recipientId for orders: ${orderRecipientId}\n`);

  // Intentionally removed from E2E: this endpoint may require 2FA in some accounts.

  // quick sanity read-only check (already fetched above)

  logStep("FULL: Pagar.me - card token + get token");
  requireEnv(["PAGARME_PUBLIC_KEY"], "Pagar.me public key (tokenization)");
  const cardTokenResp = await callTool(client, "pagarme_create_card_token", {
    card: {
      number: env("E2E_PAGARME_CARD_NUMBER") ?? "4111111111111111",
      holderName: env("E2E_PAGARME_CARD_HOLDER_NAME") ?? "E2E TEST",
      expMonth: Number(env("E2E_PAGARME_CARD_EXP_MONTH") ?? "12"),
      expYear: Number(env("E2E_PAGARME_CARD_EXP_YEAR") ?? "2030"),
      cvv: env("E2E_PAGARME_CARD_CVV") ?? "123",
      brand: env("E2E_PAGARME_CARD_BRAND") ?? "visa",
      label: "e2e",
    },
    idempotencyKey: randomId("pagarme_create_card_token"),
  });

  const tokenId = cardTokenResp?.id ?? cardTokenResp?.token ?? cardTokenResp?.cardToken ?? null;
  assert(tokenId, "pagarme_create_card_token did not return token id");
  await callTool(client, "pagarme_get_token", { tokenId });

  logStep("FULL: Pagar.me - create pix order + get order/charge + cancel charge");
  try {
    const pixOrder = await callTool(client, "pagarme_create_order_pix_split", {
      recipientId: orderRecipientId,
      items: [{ amount: 100, description: "E2E Pix", quantity: 1, category: "other" }],
      customer: {
        name: "E2E Order Customer",
        email: customerEmail,
        document: customerDoc,
        type: "individual",
        address: {
          street: "Rua Exemplo",
          number: "100",
          zipCode: "01001000",
          neighborhood: "Centro",
          city: "Sao Paulo",
          state: "SP",
          country: "BR",
        },
        phones: {
          mobilePhone: { countryCode: "55", areaCode: "11", number: "999999999" },
        },
      },
      pix: { expiresIn: 3600 },
      idempotencyKey: randomId("pagarme_create_order_pix_split"),
    });

    const orderId = pixOrder?.order?.id ?? null;
    const chargeId = pixOrder?.chargeId ?? null;
    assert(orderId, "pagarme_create_order_pix_split did not return order.id");
    assert(chargeId, "pagarme_create_order_pix_split did not return chargeId");

    await callTool(client, "pagarme_get_order", { orderId });
    await callTool(client, "pagarme_get_charge", { chargeId });
    // Cleanup: cancel the charge created by this test run
    await callTool(client, "pagarme_cancel_charge", {
      chargeId,
      idempotencyKey: randomId("pagarme_cancel_charge"),
    });
  } catch (e) {
    process.stdout.write(
      "WARNING: pagarme_create_order_pix_split failed in this environment. " +
        "This can happen if Pix/orders are not enabled/configured for the account.\n" +
        "You can still validate read endpoints by setting E2E_PAGARME_ORDER_ID and E2E_PAGARME_CHARGE_ID in your .env.\n"
    );

    const fallbackOrderId = envOptionalTrimmed("E2E_PAGARME_ORDER_ID");
    const fallbackChargeId = envOptionalTrimmed("E2E_PAGARME_CHARGE_ID");

    if (fallbackOrderId) {
      await callTool(client, "pagarme_get_order", { orderId: fallbackOrderId });
    }
    if (fallbackChargeId) {
      await callTool(client, "pagarme_get_charge", { chargeId: fallbackChargeId });
    }

    // In strict mode, fail if no fallback was possible. Otherwise, allow the rest of the flow to pass.
    if (!fallbackOrderId && !fallbackChargeId) {
      if (opts?.strict) throw e;
      process.stdout.write("Skipping Pix order flow (no fallback ids provided).\n");
    }
  }
}

async function main() {
  const { mode, strict } = parseArgs(process.argv);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  logStep(`Starting MCP server on ${baseUrl}/mcp (mode=${mode})`);
  const child = spawn("node", ["dist/index.js"], {
    env: { ...process.env, MCP_HTTP_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (d) => process.stdout.write(String(d)));
  child.stderr.on("data", (d) => process.stderr.write(String(d)));

  const cleanup = async () => {
    try {
      child.kill("SIGTERM");
    } catch {
      // ignore
    }
  };
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    await waitForHealth(baseUrl);

    const client = new Client({ name: "payments-mcp-e2e", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    await client.connect(transport);

    try {
      if (mode === "contract") await runContract(client);
      else if (mode === "smoke") await runSmoke(client);
      else await runFull(client, { strict });

      process.stdout.write("\nE2E OK\n");
    } finally {
      await client.close();
    }
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error("\nE2E FAILED\n", err?.stack ?? err);
  process.exit(1);
});


