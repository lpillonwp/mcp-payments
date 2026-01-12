import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ok, safeTool } from "@/mcp/utils.js";
import { getWooviClient } from "@/integrations/woovi/client.js";
import {
  wooviCreateChargeInputSchema,
  wooviDeleteChargeInputSchema,
  wooviGetChargeInputSchema,
  wooviListChargesInputSchema,
} from "@/integrations/woovi/schemas/charges.js";

type WooviChargeLike = any;

function pickChargeEnvelope(data: any): WooviChargeLike | null {
  if (!data) return null;
  if (data.charge) return data.charge;
  return data;
}

function normalizeCharge(data: any) {
  const charge = pickChargeEnvelope(data);
  if (!charge) return { charge: null, pix: null, raw: data };

  const paymentMethodsPix = charge.paymentMethods?.pix ?? null;
  const brCode = data?.brCode ?? charge.brCode ?? paymentMethodsPix?.brCode ?? null;

  return {
    charge: {
      correlationID: charge.correlationID ?? data?.correlationID ?? null,
      identifier: charge.identifier ?? charge.transactionID ?? charge.transactionId ?? null,
      transactionID: charge.transactionID ?? charge.transactionId ?? null,
      status: charge.status ?? null,
      value: charge.value ?? null,
      fee: charge.fee ?? null,
      expiresDate: charge.expiresDate ?? charge.expires_date ?? null,
      expiresIn: charge.expiresIn ?? charge.expires_in ?? null,
      pixKey: charge.pixKey ?? null,
      paymentLinkUrl: charge.paymentLinkUrl ?? charge.paymentLinkURL ?? null,
      qrCodeImage: charge.qrCodeImage ?? charge.qr_code_image ?? null,
      brCode,
    },
    pix: paymentMethodsPix
      ? {
          status: paymentMethodsPix.status ?? null,
          txId: paymentMethodsPix.txId ?? paymentMethodsPix.txid ?? null,
          brCode: paymentMethodsPix.brCode ?? brCode ?? null,
          qrCodeImage: paymentMethodsPix.qrCodeImage ?? null,
          transactionID: paymentMethodsPix.transactionID ?? null,
          identifier: paymentMethodsPix.identifier ?? null,
          value: paymentMethodsPix.value ?? null,
          fee: paymentMethodsPix.fee ?? null,
        }
      : null,
    raw: data,
  };
}

export function registerWooviChargeTools(server: McpServer) {
  server.registerTool(
    "woovi_create_charge",
    {
      title: "Woovi/OpenPix - Create Charge",
      description: "Cria uma cobrança Pix (OpenPix/Woovi) via POST /api/v1/charge.",
      inputSchema: wooviCreateChargeInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviCreateChargeInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.post("/charge", input);
      return ok(normalizeCharge(data));
    })
  );

  server.registerTool(
    "woovi_get_charge",
    {
      title: "Woovi/OpenPix - Get Charge",
      description: "Obtém uma cobrança por id/correlationID via GET /api/v1/charge/{id}.",
      inputSchema: wooviGetChargeInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviGetChargeInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.get(`/charge/${encodeURIComponent(input.id)}`);
      return ok(normalizeCharge(data));
    })
  );

  server.registerTool(
    "woovi_list_charges",
    {
      title: "Woovi/OpenPix - List Charges",
      description:
        "Lista cobranças via GET /api/v1/charge com filtros (start/end/status/customer/subscription).",
      inputSchema: wooviListChargesInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviListChargesInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.get("/charge", { params: input });
      const charges = Array.isArray(data?.charges)
        ? data.charges
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : null;

      return ok({
        charges: charges ? charges.map((c: any) => normalizeCharge({ charge: c }).charge) : null,
        pageInfo: data?.pageInfo ?? data?.paging ?? null,
        raw: data,
      });
    })
  );

  server.registerTool(
    "woovi_delete_charge",
    {
      title: "Woovi/OpenPix - Delete Charge",
      description: "Remove uma cobrança via DELETE /api/v1/charge/{id}.",
      inputSchema: wooviDeleteChargeInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviDeleteChargeInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.delete(`/charge/${encodeURIComponent(input.id)}`);
      return ok({ deleted: true, raw: data });
    })
  );
}


