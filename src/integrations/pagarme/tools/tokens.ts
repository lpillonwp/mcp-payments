import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getPagarmeControllers } from "@/integrations/pagarme/client.js";
import { ok, safeTool } from "@/mcp/utils.js";
import {
  pagarmeCreateCardTokenInputSchema,
  pagarmeGetTokenInputSchema,
} from "@/integrations/pagarme/schemas/tokens.js";

export function registerPagarmeTokenTools(server: McpServer) {
  server.registerTool(
    "pagarme_create_card_token",
    {
      title: "Pagar.me - Create Card Token",
      description: "Cria um card_token no Pagar.me usando a Public Key (para uso em pagamentos de cartão).",
      inputSchema: pagarmeCreateCardTokenInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCreateCardTokenInputSchema.parse(args ?? {});
      const publicKey = input.publicKey ?? process.env.PAGARME_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Public Key ausente. Informe publicKey no payload ou configure PAGARME_PUBLIC_KEY.");
      }

      const { tokens } = getPagarmeControllers();
      const { result } = await tokens.createToken(
        publicKey,
        {
          type: "card",
          card: {
            number: input.card.number,
            holderName: input.card.holderName,
            expMonth: input.card.expMonth,
            expYear: input.card.expYear,
            cvv: input.card.cvv,
            brand: input.card.brand,
            label: input.card.label ?? "default",
          },
        },
        input.idempotencyKey
      );

      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_get_token",
    {
      title: "Pagar.me - Get Token",
      description: "Busca um token no Pagar.me pelo tokenId (requer Public Key).",
      inputSchema: pagarmeGetTokenInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeGetTokenInputSchema.parse(args ?? {});
      const publicKey = input.publicKey ?? process.env.PAGARME_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error("Public Key ausente. Informe publicKey no payload ou configure PAGARME_PUBLIC_KEY.");
      }

      const { tokens } = getPagarmeControllers();
      const { result } = await tokens.getToken(input.tokenId, publicKey);
      return ok(result as any);
    })
  );
}


