import { z } from "zod";

export const wooviVerifyWebhookHmacInputSchema = z.object({
  secret: z.string().min(1),
  signature: z.string().min(1),
  body: z.string().min(1),
  algorithm: z.enum(["sha1"]).default("sha1"),
});


