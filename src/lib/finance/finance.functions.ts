import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
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
    const { updatePayoutStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updatePayoutStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const refundStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => refundSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateRefundStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateRefundStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const approvalDecisionFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => approvalSchema.parse(d))
  .handler(async ({ data }) => {
    const { decideApproval, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return decideApproval({ ...(data as object), actor: operator.email ?? operator.id } as never);
  });

export const invoiceStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => invoiceStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateInvoiceStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateInvoiceStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const createInvoiceFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createInvoiceSchema.parse(d))
  .handler(async ({ data }) => {
    const { createInvoice, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return createInvoice({ ...(data as object), actor: operator.email ?? operator.id } as never);
  });

export const adjustWalletFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => adjustWalletSchema.parse(d))
  .handler(async ({ data }) => {
    const { adjustWallet, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return adjustWallet({ ...(data as object), actor: operator.email ?? operator.id } as never);
  });

export const walletFreezeFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => walletFreezeSchema.parse(d))
  .handler(async ({ data }) => {
    const { toggleWalletFreeze, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return toggleWalletFreeze({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const gatewayToggleFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => gatewaySchema.parse(d))
  .handler(async ({ data }) => {
    const { setGatewayEnabled, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return setGatewayEnabled({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const createExpenseFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => createExpenseSchema.parse(d))
  .handler(async ({ data }) => {
    const { createExpense, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return createExpense({ ...(data as object), actor: operator.email ?? operator.id } as never);
  });

export const expenseStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => expenseStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateExpenseStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateExpenseStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const subscriptionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => subscriptionSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateSubscriptionStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateSubscriptionStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const aiControlFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => aiControlSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateAiControl, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateAiControl({ ...(data as object), actor: operator.email ?? operator.id } as never);
  });

export const taxStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => taxSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateTaxRecordStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateTaxRecordStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const fraudStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => fraudStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateFraudAlertStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateFraudAlertStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const alertStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["open", "acknowledged", "resolved"]) })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { updateAlertStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateAlertStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

export const commissionStatusFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => commissionSchema.parse(d))
  .handler(async ({ data }) => {
    const { updateCommissionStatus, requireFinanceOperator } = await import("./finance.server");
    const operator = await requireFinanceOperator();
    return updateCommissionStatus({
      ...(data as object),
      actor: operator.email ?? operator.id,
    } as never);
  });

/**
 * Who the console is acting as.
 *
 * This used to hand back whatever string the caller passed in, which is what
 * let the browser decide the name recorded against every financial change. It
 * now answers with the authenticated operator, so the console displays the
 * identity the server will actually write to the audit log.
 */
export const actorFn = createServerFn({ method: "GET" }).handler(async () => {
  const { requireFinanceOperator } = await import("./finance.server");
  const operator = await requireFinanceOperator();
  return { actor: operator.email ?? operator.id, role: operator.role };
});

/** What each payment gateway can actually do, read from the code and the server. */
export const gatewayReadinessFn = createServerFn({ method: "GET" }).handler(async () => {
  const { gatewayReadiness, requireFinanceOperator } = await import("./finance.server");
  await requireFinanceOperator();
  return gatewayReadiness();
});

/**
 * Income and expense for one business day, decided on the server in the
 * configured timezone and summed over the whole day rather than over a window
 * of rows the browser happened to hold.
 */
export const financeDayTotalsFn = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z.object({ date: z.string().optional(), timezone: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { financeDayTotals, requireFinanceOperator } = await import("./finance.server");
    await requireFinanceOperator();
    return financeDayTotals(data);
  });
