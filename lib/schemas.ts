import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  pin: z.string().length(4, "PIN must be exactly 4 digits")
         .regex(/^\d+$/, "PIN must be numbers only"),
});

export const signUpSchema = z.object({
  full_name: z.string()
    .min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  phone: z.string()
    .min(10, "Enter a valid phone number")
    .regex(/^\+?[0-9]+$/, "Enter a valid phone number"),
  pin: z.string().length(4, "PIN must be exactly 4 digits")
         .regex(/^\d+$/, "PIN must be numbers only"),
});

export const requestPayoutSchema = z.object({
  recipientAccount: z.string()
    .length(10, "Account number must be 10 digits")
    .regex(/^\d+$/, "Account number must be numbers only"),
  recipientBankCode: z.string()
    .min(1, "Select a bank"),
  amount: z.number({ message: "Enter an amount" })
    .positive("Amount must be greater than zero")
    .max(100_000_000, "Amount exceeds maximum"),
  memo: z.string().optional(),
});

export const rejectSchema = z.object({
  reason: z.string()
    .min(5, "Please provide a reason of at least 5 characters"),
});

export type SignInSchema = z.infer<typeof signInSchema>;
export type SignUpSchema = z.infer<typeof signUpSchema>;
export type RequestPayoutSchema = z.infer<typeof requestPayoutSchema>;
export type RejectSchema = z.infer<typeof rejectSchema>;
