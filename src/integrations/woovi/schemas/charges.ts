import { z } from "zod";

export const wooviTaxIdSchema = z.union([
  z.string().min(5),
  z.object({
    taxID: z.string().min(5),
    type: z.string().optional(),
  }),
]);

export const wooviCustomerSchema = z
  .object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().min(8).optional(),
    taxID: wooviTaxIdSchema.optional(),
    correlationID: z.string().min(1).optional(),
    address: z
      .object({
        zipcode: z.string().min(5),
        street: z.string().min(1),
        number: z.string().min(1),
        neighborhood: z.string().min(1),
        city: z.string().min(1),
        state: z.string().min(2),
        complement: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export const wooviCreateChargeInputSchema = z.object({
  correlationID: z.string().min(1),
  value: z.number().int().positive(),
  comment: z.string().max(140).optional(),
  customer: wooviCustomerSchema.optional(),
  type: z.string().optional(),
});

export const wooviGetChargeInputSchema = z.object({
  id: z.string().min(1),
});

export const wooviListChargesInputSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
  status: z.enum(["ACTIVE", "COMPLETED", "EXPIRED"]).optional(),
  customer: z.string().optional(),
  subscription: z.string().optional(),
});

export const wooviDeleteChargeInputSchema = z.object({
  id: z.string().min(1),
});


