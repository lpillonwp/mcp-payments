import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getPagarmeControllers } from "@/integrations/pagarme/client.js";
import { ok, safeTool } from "@/mcp/utils.js";
import {
  pagarmeCreateCustomerInputSchema,
  pagarmeGetCustomerInputSchema,
  pagarmeUpdateCustomerMetadataInputSchema,
} from "@/integrations/pagarme/schemas/customers.js";

export function registerPagarmeCustomerTools(server: McpServer) {
  server.registerTool(
    "pagarme_create_customer",
    {
      title: "Pagar.me - Create Customer",
      description: "Cria um customer no Pagar.me (Core API v5).",
      inputSchema: pagarmeCreateCustomerInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeCreateCustomerInputSchema.parse(args ?? {});
      const { customers } = getPagarmeControllers();

      const request = {
        name: input.name,
        email: input.email,
        document: input.document,
        type: input.type,
        address: input.address,
        metadata: input.metadata ?? {},
        phones: input.phones ?? {},
        code: input.code ?? input.document,
        gender: input.gender,
        documentType: input.documentType,
      };

      const { result } = await customers.createCustomer(request as any, input.idempotencyKey);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_get_customer",
    {
      title: "Pagar.me - Get Customer",
      description: "Busca um customer no Pagar.me pelo customerId.",
      inputSchema: pagarmeGetCustomerInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeGetCustomerInputSchema.parse(args ?? {});
      const { customers } = getPagarmeControllers();
      const { result } = await customers.getCustomer(input.customerId);
      return ok(result as any);
    })
  );

  server.registerTool(
    "pagarme_update_customer_metadata",
    {
      title: "Pagar.me - Update Customer Metadata",
      description: "Atualiza o metadata de um customer no Pagar.me.",
      inputSchema: pagarmeUpdateCustomerMetadataInputSchema,
    },
    safeTool(async (args) => {
      const input = pagarmeUpdateCustomerMetadataInputSchema.parse(args ?? {});
      const { customers } = getPagarmeControllers();
      const { result } = await customers.updateCustomerMetadata(
        input.customerId,
        { metadata: input.metadata },
        input.idempotencyKey
      );
      return ok(result as any);
    })
  );
}


