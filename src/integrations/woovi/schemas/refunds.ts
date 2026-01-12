import { z } from "zod";

export const wooviCreateRefundInputSchema = z.object({
  transactionEndToEndId: z.string().min(1),
  correlationID: z.string().min(1),
  value: z.number().int().positive(),
  comment: z.string().max(140).optional(),
});

export const wooviListRefundsInputSchema = z.object({});

export const wooviGetRefundInputSchema = z.object({
  id: z.string().min(1),
});

export const wooviGetChargeRefundsInputSchema = z.object({
  id: z.string().min(1),
});

export const wooviCreateChargeRefundInputSchema = z.object({
  id: z.string().min(1),
  value: z.number().int().positive(),
  correlationID: z.string().min(1),
  comment: z.string().max(140).optional(),
  transactionEndToEndId: z.string().min(1).optional(),
});


