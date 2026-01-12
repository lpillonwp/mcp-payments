import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerAllTools } from "@/tools/register.js";

export function createPaymentsMcpServer() {
  const server = new McpServer({
    name: "payments-integration-mcp",
    version: "1.0.0",
  });

  registerAllTools(server);
  return server;
}


