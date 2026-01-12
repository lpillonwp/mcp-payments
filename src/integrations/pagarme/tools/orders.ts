import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { getPagarmeControllers } from "@/integrations/pagarme/client.js";
import { ok, safeTool } from "@/mcp/utils.js";
import {
  pagarmeCreateOrderCreditCardSplitInputSchema,
  pagarmeCreateOrderPixSplitInputSchema,
} from "@/integrations/pagarme/schemas/payments.js";

function calcTotal(items: Array<{ amount: number; quantity: number }>) {
  return items.reduce((sum, item) => sum + item.amount * item.quantity, 0);
}

function normalizeOrderCustomer(input: any) {
  return {
    ...input,
    address: {
      ...input.address,
      complement: input.address.complement ?? "",
      line1: input.address.line1 ?? "",
      line2: input.address.line2 ?? "",
    },
    metadata: input.metadata ?? {},
    phones: input.phones ?? {},
    code: input.code ?? input.document,
  };
}

async function resolveSplitRecipientId(inputRecipientId: string) {
  // Split recipient_id is the gateway recipient id (commonly rp_...).
  // Allow passing a recipient id (re_...) and resolve it via getRecipient().
  if (inputRecipientId.startsWith("rp_")) return inputRecipientId;

  if (!inputRecipientId.startsWith("re_")) return inputRecipientId;

  const { recipients } = getPagarmeControllers();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const fetchGatewayId = async () => {
    const { result } = await recipients.getRecipient(inputRecipientId);
    const gatewayId =
      (Array.isArray((result as any)?.gatewayRecipients)
        ? (result as any).gatewayRecipients.find(
            (g: any) => typeof g?.id === "string" && g.id.startsWith("rp_")
          )?.id
        : null) ?? null;
    return gatewayId as string | null;
  };

  // First try immediately
  let gatewayId = await fetchGatewayId();

  // Some environments may take a short time to propagate the gateway recipient id after creation.
  // Please keep in mind that normally we'll remove this, but atm, we're using a workaround to 
  // avoid failing the tool call if the gateway recipient id is not yet available.
  if (!gatewayId) {
    await sleep(2000);
    gatewayId = await fetchGatewayId();
  }

  if (!gatewayId) {
    throw new Error(
      `Recipient ${inputRecipientId} não possui gateway recipient id (rp_...) disponível. ` +
        `Verifique se o recipient está totalmente aprovado/ativo no gateway.`
    );
  }

  return gatewayId;
}

export function registerPagarmeOrderTools(server: McpServer) {
  const pagarmeGetOrderInputSchema = z.object({ orderId: z.string().min(1) });

  server.registerTool(
    "pagarme_get_order",
    {
      title: "Pagar.me - Get Order",
      description: "Busca detalhes de um pedido no Pagar.me V5 pelo ID do pedido (ex: or_xxxxxxxx).",
      inputSchema: pagarmeGetOrderInputSchema,
    },
    safeTool(async (args) => {
      const orderId = pagarmeGetOrderInputSchema.parse(args ?? {}).orderId;
      const { orders } = getPagarmeControllers();
      const { result } = await orders.getOrder(orderId);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_create_order_pix_split",
    {
      title: "Pagar.me - Create Order (Pix + Split)",
      description:
        "Cria um order com pagamento Pix e split 100% para um recipient (personal). Retorna QRCode/QRCodeUrl/ExpiresAt via transações da charge.",
      inputSchema: pagarmeCreateOrderPixSplitInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCreateOrderPixSplitInputSchema.parse(args ?? {});
      const { orders, charges } = getPagarmeControllers();

      const totalAmount = calcTotal(input.items);
      const splitRecipientId = await resolveSplitRecipientId(input.recipientId);
      const split = [
        {
          type: "flat",
          amount: totalAmount,
          recipientId: splitRecipientId,
          options: {
            liable: true,
            chargeProcessingFee: true,
            // keep defaults close to SDK examples; some accounts may reject charge_remainder_fee for Pix
            chargeRemainderFee: false,
          },
        },
      ];

      const orderCode = input.code ?? `pix_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const body = {
        items: input.items,
        customer: normalizeOrderCustomer(input.customer),
        payments: [
          {
            paymentMethod: "pix",
            split,
            pix: input.pix,
          },
        ],
        code: orderCode,
        closed: true,
        metadata: input.metadata ?? {},
      };

      const { result: order } = await orders.createOrder(body as any, input.idempotencyKey);
      const chargeId = order.charges?.[0]?.id ?? null;

      let pixData: any = null;
      if (chargeId) {
        const { result: txs } = await charges.getChargeTransactions(chargeId);
        const data = (txs.data ?? []) as any[];
        const txWithQr =
          data.find((t) => t?.qrCode || t?.qr_code || t?.qrCodeUrl || t?.qr_code_url) ?? null;

        if (txWithQr) {
          pixData = {
            qrCode: txWithQr.qrCode ?? txWithQr.qr_code ?? null,
            qrCodeUrl: txWithQr.qrCodeUrl ?? txWithQr.qr_code_url ?? null,
            expiresAt: txWithQr.expiresAt ?? txWithQr.expires_at ?? null,
            endToEndId: txWithQr.endToEndId ?? txWithQr.end_to_end_id ?? null,
            status: txWithQr.status ?? null,
          };
        }
      }

      return ok({ order, chargeId, pix: pixData } as any);
    })
  );

  server.registerTool(
    "pagarme_create_order_credit_card_split",
    {
      title: "Pagar.me - Create Order (Credit Card + Split)",
      description:
        "Cria um order com pagamento de cartão de crédito e split 100% para um recipient (personal).",
      inputSchema: pagarmeCreateOrderCreditCardSplitInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCreateOrderCreditCardSplitInputSchema.parse(args ?? {});
      const { orders } = getPagarmeControllers();

      if (!input.creditCard.cardToken && !input.creditCard.cardId) {
        throw new Error("Informe creditCard.cardToken ou creditCard.cardId.");
      }

      const totalAmount = calcTotal(input.items);
      const split = [
        {
          type: "flat",
          amount: totalAmount,
          recipientId: input.recipientId,
          options: {
            liable: true,
            chargeProcessingFee: true,
            chargeRemainderFee: true,
          },
        },
      ];

      const orderCode = input.code ?? `cc_${Date.now()}`;
      const body = {
        items: input.items,
        customer: normalizeOrderCustomer(input.customer),
        payments: [
          {
            paymentMethod: "credit_card",
            amount: totalAmount,
            split,
            creditCard: {
              installments: input.creditCard.installments,
              capture: input.creditCard.capture,
              statementDescriptor: input.creditCard.statementDescriptor,
              cardId: input.creditCard.cardId,
              cardToken: input.creditCard.cardToken,
            },
          },
        ],
        code: orderCode,
        closed: true,
        metadata: input.metadata ?? {},
      };

      const { result: order } = await orders.createOrder(body as any, input.idempotencyKey);
      const chargeId = order.charges?.[0]?.id ?? null;
      return ok({ order, chargeId } as any);
    })
  );
}


