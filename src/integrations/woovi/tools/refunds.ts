import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { ok, safeTool } from "@/mcp/utils.js";
import { getWooviClient } from "@/integrations/woovi/client.js";
import {
  wooviCreateChargeRefundInputSchema,
  wooviCreateRefundInputSchema,
  wooviGetChargeRefundsInputSchema,
  wooviGetRefundInputSchema,
  wooviListRefundsInputSchema,
} from "@/integrations/woovi/schemas/refunds.js";

export function registerWooviRefundTools(server: McpServer) {
  server.registerTool(
    "woovi_create_refund",
    {
      title: "Woovi/OpenPix - Create Refund",
      description: "Cria um refund via POST /api/v1/refund (por transactionEndToEndId).",
      inputSchema: wooviCreateRefundInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviCreateRefundInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.post("/refund", input);
      return ok(data);
    })
  );

  server.registerTool(
    "woovi_list_refunds",
    {
      title: "Woovi/OpenPix - List Refunds",
      description: "Lista refunds via GET /api/v1/refund.",
      inputSchema: wooviListRefundsInputSchema,
    },
    safeTool(async (args) => {
      wooviListRefundsInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.get("/refund");
      return ok(data);
    })
  );

  server.registerTool(
    "woovi_get_refund",
    {
      title: "Woovi/OpenPix - Get Refund",
      description: "Busca um refund via GET /api/v1/refund/{id} (refundId ou correlationID).",
      inputSchema: wooviGetRefundInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviGetRefundInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.get(`/refund/${encodeURIComponent(input.id)}`);
      return ok(data);
    })
  );

  server.registerTool(
    "woovi_get_charge_refunds",
    {
      title: "Woovi/OpenPix - Get Charge Refunds",
      description: "Lista refunds de uma cobrança via GET /api/v1/charge/{id}/refund.",
      inputSchema: wooviGetChargeRefundsInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviGetChargeRefundsInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { data } = await http.get(`/charge/${encodeURIComponent(input.id)}/refund`);
      return ok(data);
    })
  );

  server.registerTool(
    "woovi_create_charge_refund",
    {
      title: "Woovi/OpenPix - Create Charge Refund",
      description:
        "Cria um refund para uma cobrança via POST /api/v1/charge/{id}/refund (quando suportado/necessário).",
      inputSchema: wooviCreateChargeRefundInputSchema,
    },
    safeTool(async (args) => {
      const input = wooviCreateChargeRefundInputSchema.parse(args ?? {});
      const { http } = getWooviClient();
      const { id, ...payload } = input;
      const { data } = await http.post(`/charge/${encodeURIComponent(id)}/refund`, payload);
      return ok(data);
    })
  );
}


