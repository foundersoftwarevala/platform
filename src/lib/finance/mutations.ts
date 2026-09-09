import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  adjustWalletFn,
  aiControlFn,
  alertStatusFn,
  approvalDecisionFn,
  commissionStatusFn,
  createExpenseFn,
  createInvoiceFn,
  expenseStatusFn,
  fraudStatusFn,
  gatewayToggleFn,
  invoiceStatusFn,
  payoutStatusFn,
  refundStatusFn,
  subscriptionStatusFn,
  taxStatusFn,
  walletFreezeFn,
} from "./finance.functions";

/** Every finance mutation refreshes the whole finance cache so KPI cards stay in sync. */
function useFinanceMutation<TInput, TOutput>(
  fn: (opts: { data: TInput }) => Promise<TOutput>,
  successMessage: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => fn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(successMessage);
    },
    onError: (error: Error) => toast.error(error.message || "Action failed"),
  });
}

export const useUpdatePayout = () =>
  useFinanceMutation(useServerFn(payoutStatusFn), "Payout updated");
export const useUpdateRefund = () =>
  useFinanceMutation(useServerFn(refundStatusFn), "Refund updated");
export const useDecideApproval = () =>
  useFinanceMutation(useServerFn(approvalDecisionFn), "Approval recorded");
export const useUpdateInvoice = () =>
  useFinanceMutation(useServerFn(invoiceStatusFn), "Invoice updated");
export const useCreateInvoice = () =>
  useFinanceMutation(useServerFn(createInvoiceFn), "Invoice generated");
export const useAdjustWallet = () =>
  useFinanceMutation(useServerFn(adjustWalletFn), "Wallet adjusted");
export const useToggleWalletFreeze = () =>
  useFinanceMutation(useServerFn(walletFreezeFn), "Wallet status updated");
export const useToggleGateway = () =>
  useFinanceMutation(useServerFn(gatewayToggleFn), "Gateway updated");
export const useCreateExpense = () =>
  useFinanceMutation(useServerFn(createExpenseFn), "Expense recorded");
export const useUpdateExpense = () =>
  useFinanceMutation(useServerFn(expenseStatusFn), "Expense updated");
export const useUpdateSubscription = () =>
  useFinanceMutation(useServerFn(subscriptionStatusFn), "Subscription updated");
export const useUpdateAiControl = () =>
  useFinanceMutation(useServerFn(aiControlFn), "AI billing control saved");
export const useUpdateTaxRecord = () =>
  useFinanceMutation(useServerFn(taxStatusFn), "Tax record updated");
export const useUpdateFraudAlert = () =>
  useFinanceMutation(useServerFn(fraudStatusFn), "Fraud alert updated");
export const useUpdateAlert = () =>
  useFinanceMutation(useServerFn(alertStatusFn), "Alert updated");
export const useUpdateCommission = () =>
  useFinanceMutation(useServerFn(commissionStatusFn), "Commission updated");
