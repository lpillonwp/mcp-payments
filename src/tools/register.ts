import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPagarmeChargeTools } from "@/integrations/pagarme/tools/charges.js";
import { registerPagarmeCustomerTools } from "@/integrations/pagarme/tools/customers.js";
import { registerPagarmeOrderTools } from "@/integrations/pagarme/tools/orders.js";
import { registerPagarmeRecipientTools } from "@/integrations/pagarme/tools/recipients.js";
import { registerPagarmeTokenTools } from "@/integrations/pagarme/tools/tokens.js";
import { registerWooviChargeTools } from "@/integrations/woovi/tools/charges.js";
import { registerWooviRefundTools } from "@/integrations/woovi/tools/refunds.js";
import { registerWooviWebhookTools } from "@/integrations/woovi/tools/webhooks.js";

export function registerAllTools(server: McpServer) {
  registerPagarmeCustomerTools(server);
  registerPagarmeRecipientTools(server);
  registerPagarmeOrderTools(server);
  registerPagarmeChargeTools(server);
  registerPagarmeTokenTools(server);
  registerWooviChargeTools(server);
  registerWooviRefundTools(server);
  registerWooviWebhookTools(server);
}


