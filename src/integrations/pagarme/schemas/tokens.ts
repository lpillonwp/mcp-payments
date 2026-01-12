import { z } from "zod";

export const pagarmeCreateCardTokenInputSchema = z.object({
  publicKey: z.string().min(1).optional(),
  card: z.object({
    number: z.string().min(12),
    holderName: z.string().min(1),
    expMonth: z.number().int().min(1).max(12),
    expYear: z.number().int().min(0),
    cvv: z.string().min(3),
    brand: z.string().min(1),
    label: z.string().min(1).optional(),
  }),
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeGetTokenInputSchema = z.object({
  tokenId: z.string().min(1),
  publicKey: z.string().min(1).optional(),
});


