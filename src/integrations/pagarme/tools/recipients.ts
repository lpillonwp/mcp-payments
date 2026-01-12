import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getPagarmeControllers } from "@/integrations/pagarme/client.js";
import { ok, safeTool } from "@/mcp/utils.js";
import {
  pagarmeCreateRecipientInputSchema,
  pagarmeGetRecipientsInputSchema,
  pagarmeUpdateRecipientDefaultBankAccountInputSchema,
} from "@/integrations/pagarme/schemas/recipients.js";

export function registerPagarmeRecipientTools(server: McpServer) {
  server.registerTool(
    "pagarme_create_recipient",
    {
      title: "Pagar.me - Create Recipient",
      description: "Cria um recipient (personal) no Pagar.me com conta bancária padrão.",
      inputSchema: pagarmeCreateRecipientInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCreateRecipientInputSchema.parse(args ?? {});
      const { recipients } = getPagarmeControllers();

      const request = {
        name: input.name,
        email: input.email,
        description: input.description,
        document: input.document,
        type: input.type,
        defaultBankAccount: {
          ...input.defaultBankAccount,
          metadata: input.defaultBankAccount.metadata ?? {},
        },
        metadata: input.metadata ?? {},
        code: input.code ?? input.document,
        paymentMode: input.paymentMode,
      };

      const { result } = await recipients.createRecipient(request as any, input.idempotencyKey);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_update_recipient_default_bank_account",
    {
      title: "Pagar.me - Update Recipient Default Bank Account",
      description: "Atualiza a conta bancária padrão de um recipient (personal) no Pagar.me.",
      inputSchema: pagarmeUpdateRecipientDefaultBankAccountInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeUpdateRecipientDefaultBankAccountInputSchema.parse(args ?? {});
      const { recipients } = getPagarmeControllers();

      const request = {
        bankAccount: {
          ...input.bankAccount,
          metadata: input.bankAccount.metadata ?? {},
        },
        paymentMode: input.paymentMode,
      };

      const { result } = await recipients.updateRecipientDefaultBankAccount(
        input.recipientId,
        request as any,
        input.idempotencyKey
      );

      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_get_recipients",
    {
      title: "Pagar.me - List Recipients",
      description: "Lista recipients (paginado) no Pagar.me.",
      inputSchema: pagarmeGetRecipientsInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeGetRecipientsInputSchema.parse(args ?? {});
      const { recipients } = getPagarmeControllers();
      const { result } = await recipients.getRecipients(input.page, input.size);
      return ok(result as any);
    })
  );
}


