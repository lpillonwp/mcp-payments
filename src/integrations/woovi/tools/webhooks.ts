import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import crypto from "crypto";

import { ok, safeTool } from "@/mcp/utils.js";
import { wooviVerifyWebhookHmacInputSchema } from "@/integrations/woovi/schemas/webhooks.js";

export function registerWooviWebhookTools(server: McpServer) {
  server.registerTool(
    "woovi_verify_webhook_hmac",
    {
      title: "Woovi/OpenPix - Verify Webhook HMAC",
      description:
        "Valida assinatura HMAC do webhook (header X-OpenPix-Signature) usando sha1 e base64, conforme docs do OpenPix.",
      inputSchema: wooviVerifyWebhookHmacInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviVerifyWebhookHmacInputSchema.parse(args ?? {});
      const computed = crypto
        .createHmac(input.algorithm, input.secret)
        .update(input.body)
        .digest("base64");

      return ok({
        valid: computed === input.signature,
        computedSignature: computed,
      });
    })
  );
}


