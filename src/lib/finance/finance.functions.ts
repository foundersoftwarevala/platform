import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  actorSchema,
  aiControlSchema,
  adjustWalletSchema,
  approvalSchema,
  commissionSchema,
  createExpenseSchema,
  createInvoiceSchema,
  expenseStatusSchema,
  fraudStatusSchema,
  gatewaySchema,
  invoiceStatusSchema,
  payoutSchema,
  refundSchema,
  subscriptionSchema,
  taxSchema,
  walletFreezeSchema,
} from "./schemas";

export const payoutStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => payoutSchema.parse(d))
  .handler(async ({ data }) => {
    const { updatePayoutStatus } = await import("./finance.server");
    return updatePayoutStatus(data);
  });

export const refundStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => refundSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateRefundStatus } = await import("./finance.server");
    return updateRefundStatus(data);
  });

export const approvalDecisionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => approvalSchema.parse(d))
  .handler(async ({ data }) => {
    const { decideApproval } = await import("./finance.server");
    return decideApproval(data);
  });

export const invoiceStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => invoiceStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateInvoiceStatus } = await import("./finance.server");
    return updateInvoiceStatus(data);
  });

export const createInvoiceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createInvoiceSchema.parse(d))
  .handler(async ({ data }) => {
    const { createInvoice } = await import("./finance.server");
    return createInvoice(data);
  });

export const adjustWalletFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adjustWalletSchema.parse(d))
  .handler(async ({ data }) => {
    const { adjustWallet } = await import("./finance.server");
    return adjustWallet(data);
  });

export const walletFreezeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => walletFreezeSchema.parse(d))
  .handler(async ({ data }) => {
    const { toggleWalletFreeze } = await import("./finance.server");
    return toggleWalletFreeze(data);
  });

export const gatewayToggleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => gatewaySchema.parse(d))
  .handler(async ({ data }) => {
    const { setGatewayEnabled } = await import("./finance.server");
    return setGatewayEnabled(data);
  });

export const createExpenseFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createExpenseSchema.parse(d))
  .handler(async ({ data }) => {
    const { createExpense } = await import("./finance.server");
    return createExpense(data);
  });

export const expenseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => expenseStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateExpenseStatus } = await import("./finance.server");
    return updateExpenseStatus(data);
  });

export const subscriptionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscriptionSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateSubscriptionStatus } = await import("./finance.server");
    return updateSubscriptionStatus(data);
  });

export const aiControlFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => aiControlSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateAiControl } = await import("./finance.server");
    return updateAiControl(data);
  });

export const taxStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => taxSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateTaxRecordStatus } = await import("./finance.server");
    return updateTaxRecordStatus(data);
  });

export const fraudStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fraudStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateFraudAlertStatus } = await import("./finance.server");
    return updateFraudAlertStatus(data);
  });

export const alertStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["open", "acknowledged", "resolved"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { updateAlertStatus } = await import("./finance.server");
    return updateAlertStatus(data);
  });

export const commissionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commissionSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateCommissionStatus } = await import("./finance.server");
    return updateCommissionStatus(data);
  });

export const actorFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => actorSchema.parse(d))
  .handler(async ({ data }) => ({ actor: data.actor }));
