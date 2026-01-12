import { z } from "zod";

export const pagarmeOrderItemSchema = z.object({
  amount: z.number().int().positive(),
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  category: z.string().min(1).default("other"),
  code: z.string().min(1).optional(),
});

export const pagarmeSplitSchema = z.object({
  recipientId: z.string().min(1),
  amount: z.number().int().positive(),
  type: z.string().default("flat"),
  options: z
    .object({
      liable: z.boolean().optional(),
      chargeProcessingFee: z.boolean().optional(),
      chargeRemainderFee: z.boolean().optional(),
    })
    .optional(),
  splitRuleId: z.string().optional(),
});

export const pagarmeCustomerForOrderSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  document: z.string().min(5),
  type: z.enum(["individual", "company"]),
  address: z.object({
    street: z.string().min(1),
    number: z.string().min(1),
    zipCode: z.string().min(1),
    neighborhood: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().min(2),
    complement: z.string().default(""),
    line1: z.string().default(""),
    line2: z.string().default(""),
  }),
  metadata: z.record(z.string()).optional(),
  phones: z
    .object({
      homePhone: z
        .object({
          countryCode: z.string().min(1),
          areaCode: z.string().min(1),
          number: z.string().min(1),
        })
        .optional(),
      mobilePhone: z
        .object({
          countryCode: z.string().min(1),
          areaCode: z.string().min(1),
          number: z.string().min(1),
        })
        .optional(),
    })
    .optional(),
  code: z.string().min(1).optional(),
});

export const pagarmeCreateOrderPixSplitInputSchema = z.object({
  recipientId: z.string().min(1),
  items: z.array(pagarmeOrderItemSchema).min(1),
  customer: pagarmeCustomerForOrderSchema,
  pix: z
    .object({
      expiresIn: z.number().int().positive().optional(),
      expiresAt: z.string().optional(),
    })
    .optional(),
  code: z.string().min(1).optional(),
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeCreateOrderCreditCardSplitInputSchema = z.object({
  recipientId: z.string().min(1),
  items: z.array(pagarmeOrderItemSchema).min(1),
  customer: pagarmeCustomerForOrderSchema,
  creditCard: z.object({
    installments: z.number().int().positive().optional(),
    capture: z.boolean().default(true),
    statementDescriptor: z.string().min(1).optional(),
    cardId: z.string().min(1).optional(),
    cardToken: z.string().min(1).optional(),
  }),
  code: z.string().min(1).optional(),
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeGetChargeInputSchema = z.object({
  chargeId: z.string().min(1),
});

export const pagarmeGetChargeTransactionsInputSchema = z.object({
  chargeId: z.string().min(1),
  page: z.number().int().positive().optional(),
  size: z.number().int().positive().optional(),
});

export const pagarmeCaptureChargeInputSchema = z.object({
  chargeId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  recipientId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeCancelChargeInputSchema = z.object({
  chargeId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  recipientId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).optional(),
});


