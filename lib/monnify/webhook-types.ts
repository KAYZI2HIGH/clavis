import { z } from "zod";

export const MonnifyWebhookEventSchema = z.object({
  eventType: z.enum([
    "SUCCESSFUL_TRANSACTION",
    "SUCCESSFUL_DISBURSEMENT",
    "FAILED_DISBURSEMENT",
    "REVERSED_DISBURSEMENT",
  ]),
  eventData: z.record(z.string(), z.unknown()),
});

export type MonnifyWebhookEvent = z.infer<typeof MonnifyWebhookEventSchema>;

export const MonnifyTransactionEventDataSchema = z.object({
  transactionReference: z.string(),
  paymentReference: z.string(),
  amountPaid: z.number(), // NOTE: In Naira
  totalPayable: z.number(),
  settlementAmount: z.number(),
  paidOn: z.string(),
  paymentStatus: z.string(),
  paymentDescription: z.string().optional(),
  product: z.object({
    reference: z.string(),
    type: z.string(),
  }).optional(),
  customer: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
  destinationAccountInformation: z.object({
    bankCode: z.string(),
    bankName: z.string(),
    accountNumber: z.string(),
  }).optional(),
});

export type MonnifyTransactionEventData = z.infer<
  typeof MonnifyTransactionEventDataSchema
>;

export const MonnifyDisbursementEventDataSchema = z.object({
  reference: z.string(),
  amount: z.number(), // NOTE: In Naira
  status: z.string(),
  destinationAccountNumber: z.string(),
  destinationBankCode: z.string(),
  destinationBankName: z.string().optional(),
  destinationAccountName: z.string().optional(),
});

export type MonnifyDisbursementEventData = z.infer<
  typeof MonnifyDisbursementEventDataSchema
>;

export function parseMonnifyWebhookPayload(payload: unknown): MonnifyWebhookEvent | null {
  const result = MonnifyWebhookEventSchema.safeParse(payload);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export function parseTransactionEventData(data: unknown): MonnifyTransactionEventData | null {
  const result = MonnifyTransactionEventDataSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  return result.data;
}

export function parseDisbursementEventData(data: unknown): MonnifyDisbursementEventData | null {
  const result = MonnifyDisbursementEventDataSchema.safeParse(data);
  if (!result.success) {
    return null;
  }
  return result.data;
}
