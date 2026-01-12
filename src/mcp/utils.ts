import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ApiError } from "@pagarme/pagarme-nodejs-sdk";

// Format API responses for MCP.
export function ok<T extends Record<string, unknown>>(data: T): CallToolResult {
  const text = JSON.stringify(
    data,
    (_key, value) => (typeof value === "bigint" ? value.toString() : value),
    2
  );
  return {
    content: [{ type: "text", text }],
    structuredContent: data,
  };
}

// Handle API errors from Pagar.me/Woovi/OpenPix.
export function fail(error: unknown): CallToolResult {
  const message =
    error instanceof ApiError
      ? JSON.stringify(
          {
            statusCode: (error as any).statusCode ?? (error as any).responseCode ?? null,
            result: (error as any).result ?? null,
            errors: (error as any).errors ?? null,
          },
          (_key, value) => (typeof value === "bigint" ? value.toString() : value)
        )
      : typeof error === "object" &&
          error !== null &&
          "response" in error &&
          (error as any).response?.data
        ? JSON.stringify((error as any).response.data)
        : error instanceof Error
          ? error.message
          : String(error);

  return {
    content: [{ type: "text", text: `Erro na API: ${message}` }],
    isError: true,
  };
}

// Facilitate tool calls by wrapping the handler in a try/catch and returning a CallToolResult.
export function safeTool(
  handler: (args: unknown) => Promise<CallToolResult> | CallToolResult
): (args: unknown) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return await handler(args);
    } catch (error) {
      return fail(error);
    }
  };
}


