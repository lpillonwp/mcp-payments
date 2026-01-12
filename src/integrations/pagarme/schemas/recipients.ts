import { z } from "zod";

export const pagarmeBankAccountSchema = z.object({
  holderName: z.string().min(1),
  holderType: z.string().min(1),
  holderDocument: z.string().min(1),
  bank: z.string().min(1),
  branchNumber: z.string().min(1),
  branchCheckDigit: z.string().optional(),
  accountNumber: z.string().min(1),
  accountCheckDigit: z.string().min(1),
  type: z.string().min(1),
  pixKey: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const pagarmeCreateRecipientInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  description: z.string().optional(),
  document: z.string().min(5),
  type: z.enum(["individual", "company"]),
  code: z.string().min(1).optional(),
  paymentMode: z.string().default("bank_transfer"),
  defaultBankAccount: pagarmeBankAccountSchema,
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeUpdateRecipientDefaultBankAccountInputSchema = z.object({
  recipientId: z.string().min(1),
  paymentMode: z.string().default("bank_transfer"),
  bankAccount: pagarmeBankAccountSchema,
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeGetRecipientsInputSchema = z.object({
  page: z.number().int().positive().optional(),
  size: z.number().int().positive().optional(),
});


