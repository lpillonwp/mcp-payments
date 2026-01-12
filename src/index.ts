import dotenv from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { startMcpHttpServer } from "@/http/server.js";
import { createPaymentsMcpServer } from "@/mcp/server.js";
import { fail } from "@/mcp/utils.js";

dotenv.config();

const server = createPaymentsMcpServer();

/**
 * Always remember to remove this if you're not using the HTTP transport.
 * Actually, this is not used in the project, but makes sense to keep it here as
 * it's a good example of how to use the HTTP transport. Plus, 
 * we use it at the testing and CI/CD pipelines to keep integration tests working.
 */
const httpPortRaw = process.env.MCP_HTTP_PORT;
if (httpPortRaw) {
  const port = Number(httpPortRaw);
  if (!Number.isFinite(port) || port <= 0) {
    console.error("MCP_HTTP_PORT inválida (deve ser número > 0).");
    process.exit(1);
  }
  startMcpHttpServer(server, port);
}

// Handle errors from the MCP server.
server.server.onerror = (error) => {
  // eslint-disable-next-line no-console
  const result = fail(error);
  const first = result.content?.[0];
  // eslint-disable-next-line no-console
  console.error(first && "text" in first ? (first as any).text : error);
};

// Connect the MCP server to the transport.
const transport = new StdioServerTransport();
await server.connect(transport);
