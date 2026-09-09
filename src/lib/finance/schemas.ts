import { z } from "zod";

export const actorSchema = z.object({ actor: z.string().min(1) });

const id = z.string().uuid();
const actor = z.string().min(1).default("finance_manager");

export const payoutSchema = z.object({
  id,
  status: z.enum(["approved", "rejected", "processing", "paid", "on_hold"]),
  actor,
  note: z.string().optional(),
});

export const refundSchema = z.object({
  id,
  status: z.enum(["approved", "rejected", "processed"]),
  actor,
  note: z.string().optional(),
});

export const approvalSchema = z.object({
  id,
  decision: z.enum(["approved", "rejected"]),
  actor,
  note: z.string().optional(),
});

export const invoiceStatusSchema = z.object({
  id,
  status: z.enum(["draft", "unpaid", "paid", "overdue", "cancelled"]),
  actor,
});

export const createInvoiceSchema = z.object({
  clientName: z.string().min(1),
  clientType: z.string().min(1),
  docType: z.enum(["invoice", "credit_note", "debit_note", "tax_invoice"]),
  gstNumber: z.string().optional(),
  dueDate: z.string().min(1),
  taxPercent: z.number().min(0).max(100),
  lineItems: z
    .array(z.object({ description: z.string().min(1), qty: z.number().positive(), rate: z.number().min(0) }))
    .min(1),
  actor,
});

export const adjustWalletSchema = z.object({
  walletId: id,
  amount: z.number().positive(),
  entryType: z.enum(["credit", "debit"]),
  reason: z.string().min(1),
  actor,
});

export const walletFreezeSchema = z.object({ walletId: id, frozen: z.boolean(), actor });

export const gatewaySchema = z.object({ id, enabled: z.boolean(), actor });

export const createExpenseSchema = z.object({
  category: z.string().min(1),
  vendor: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  expenseDate: z.string().min(1),
  recurring: z.boolean(),
  actor,
});

export const expenseStatusSchema = z.object({
  id,
  status: z.enum(["pending", "approved", "rejected", "reimbursed"]),
  actor,
});

export const subscriptionSchema = z.object({
  id,
  status: z.enum(["active", "cancelled", "paused", "expired"]),
  planId: id.optional(),
  actor,
});

export const aiControlSchema = z.object({
  provider: z.string().min(1),
  service: z.string().min(1),
  status: z.enum(["active", "stopped"]).optional(),
  budget: z.number().min(0).optional(),
  spikeThreshold: z.number().min(0).optional(),
  autoStopPercent: z.number().min(1).max(100).optional(),
  actor,
});

export const taxSchema = z.object({
  id,
  status: z.enum(["pending", "filed", "paid", "overdue"]),
  actor,
});

export const fraudStatusSchema = z.object({
  id,
  status: z.enum(["open", "investigating", "resolved", "false_positive"]),
  actor,
});

export const commissionSchema = z.object({
  id,
  status: z.enum(["pending", "approved", "paid", "reversed"]),
  actor,
});
