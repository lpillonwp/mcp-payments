import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { createPaymentsMcpServer } from "@/mcp/server.js";

export function startMcpHttpServer(_server: McpServer, port: number) {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  /**
   * MCP over HTTP (Streamable HTTP) with sessions.
   *
   * Session lifecycle:
   * - POST /mcp: initialize session (no mcp-session-id + initialize request)
   * - POST /mcp: reuse session (mcp-session-id)
   * - GET /mcp: streaming/poll for session (mcp-session-id)
   * - DELETE /mcp: close session (mcp-session-id)
   */
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    const existing = sessionId ? transports[sessionId] : undefined;

    const body = req.body;
    const isInit =
      isInitializeRequest(body) ||
      (Array.isArray(body) && body.some((item) => isInitializeRequest(item)));

    if (process.env.MCP_HTTP_DEBUG) {
      // eslint-disable-next-line no-console
      console.error("MCP_HTTP_DEBUG POST /mcp", {
        sessionId,
        hasExisting: Boolean(existing),
        bodyType: Array.isArray(body) ? "array" : typeof body,
        body,
      });
    }

    if (existing) {
      await existing.handleRequest(req, res, body);
      return;
    }

    // If there's no valid session, only allow creating a new one via initialize
    if (!isInit) {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Invalid session" },
        id: null,
      });
      return;
    }

    const newSessionId = randomUUID();
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      // Pre-generate the session id so we can register it immediately,
      // avoiding race conditions with fast follow-up requests (e.g. notifications/initialized).
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
      onsessionclosed: (id) => {
        delete transports[id];
      },
    });

    // Ensure session is available immediately for follow-up requests.
    transports[newSessionId] = transport;

    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };

    // Important: connect a dedicated McpServer instance per session
    // (avoid concurrent connect() calls against a shared server instance)
    const sessionServer = createPaymentsMcpServer();
    await sessionServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing mcp-session-id");
      return;
    }
    const transport = transports[sessionId];
    if (!transport) {
      res.status(400).send("Invalid session");
      return;
    }
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing mcp-session-id");
      return;
    }
    const transport = transports[sessionId];
    if (!transport) {
      res.status(400).send("Invalid session");
      return;
    }
    await transport.handleRequest(req, res);
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`MCP HTTP transport listening on http://localhost:${port}/mcp`);
  });
}


