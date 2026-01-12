import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getPagarmeControllers } from "@/integrations/pagarme/client.js";
import { ok, safeTool } from "@/mcp/utils.js";
import {
  pagarmeCancelChargeInputSchema,
  pagarmeCaptureChargeInputSchema,
  pagarmeGetChargeInputSchema,
  pagarmeGetChargeTransactionsInputSchema,
} from "@/integrations/pagarme/schemas/payments.js";

export function registerPagarmeChargeTools(server: McpServer) {
  server.registerTool(
    "pagarme_get_charge",
    {
      title: "Pagar.me - Get Charge",
      description: "Busca uma charge no Pagar.me pelo chargeId.",
      inputSchema: pagarmeGetChargeInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeGetChargeInputSchema.parse(args ?? {});
      const { charges } = getPagarmeControllers();
      const { result } = await charges.getCharge(input.chargeId);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_get_charge_transactions",
    {
      title: "Pagar.me - List Charge Transactions",
      description: "Lista transações de uma charge (útil para Pix, incluindo QRCode).",
      inputSchema: pagarmeGetChargeTransactionsInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeGetChargeTransactionsInputSchema.parse(args ?? {});
      const { charges } = getPagarmeControllers();
      const { result } = await charges.getChargeTransactions(input.chargeId, input.page, input.size);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_capture_charge",
    {
      title: "Pagar.me - Capture Charge",
      description: "Captura uma charge (quando cartão foi criado com capture=false).",
      inputSchema: pagarmeCaptureChargeInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCaptureChargeInputSchema.parse(args ?? {});
      const { charges } = getPagarmeControllers();

      const request =
        input.amount || input.recipientId
          ? ({
              amount: input.amount,
              split:
                input.amount && input.recipientId
                  ? [
                      {
                        type: "flat",
                        amount: input.amount,
                        recipientId: input.recipientId,
                        options: { liable: true, chargeProcessingFee: true, chargeRemainderFee: true },
                      },
                    ]
                  : undefined,
            } as any)
          : undefined;

      const { result } = await charges.captureCharge(input.chargeId, request, input.idempotencyKey);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_cancel_charge",
    {
      title: "Pagar.me - Cancel Charge",
      description: "Cancela/estorna uma charge.",
      inputSchema: pagarmeCancelChargeInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCancelChargeInputSchema.parse(args ?? {});
      const { charges } = getPagarmeControllers();

      const request =
        input.amount || input.recipientId
          ? ({
              amount: input.amount,
              split:
                input.amount && input.recipientId
                  ? [
                      {
                        type: "flat",
                        amount: input.amount,
                        recipientId: input.recipientId,
                        options: { liable: true, chargeProcessingFee: true, chargeRemainderFee: true },
                      },
                    ]
                  : undefined,
            } as any)
          : undefined;

      const { result } = await charges.cancelCharge(input.chargeId, request, input.idempotencyKey);
      return ok(result as any);
    })
  );
}


