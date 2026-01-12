import { z } from "zod";

export const pagarmeAddressSchema = z.object({
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
  metadata: z.record(z.string()).optional(),
});

export const pagarmePhoneSchema = z.object({
  countryCode: z.string().min(1),
  areaCode: z.string().min(1),
  number: z.string().min(1),
  type: z.string().optional(),
});

export const pagarmePhonesSchema = z.object({
  homePhone: pagarmePhoneSchema.optional(),
  mobilePhone: pagarmePhoneSchema.optional(),
});

export const pagarmeCreateCustomerInputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  document: z.string().min(5),
  type: z.enum(["individual", "company"]),
  address: pagarmeAddressSchema,
  code: z.string().min(1).optional(),
  metadata: z.record(z.string()).optional(),
  phones: pagarmePhonesSchema.optional(),
  gender: z.string().optional(),
  documentType: z.string().optional(),
  idempotencyKey: z.string().min(1).optional(),
});

export const pagarmeGetCustomerInputSchema = z.object({
  customerId: z.string().min(1),
});

export const pagarmeUpdateCustomerMetadataInputSchema = z.object({
  customerId: z.string().min(1),
  metadata: z.record(z.string()),
  idempotencyKey: z.string().min(1).optional(),
});


