import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Eye, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMyPermissions, useSupabaseSession } from "@/hooks/use-session";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { MessageKey } from "@/lib/i18n/messages";
import { formatWalletAmount } from "@/lib/wallet/format";
import { markPaid } from "@/lib/tasks/functions";
import {
  createWallet,
  debitFine,
  listDeveloperWallets,
  listDueTaskPayments,
  listTransactions,
  payout,
  setTaskAmount,
} from "@/lib/wallet/functions";
import type {
  DeveloperWalletSummaryDTO,
  DueTaskPaymentDTO,
  WalletTransactionDTO,
  WalletTransactionType,
} from "@/lib/wallet/types";

const transactionLabels: Record<WalletTransactionType, MessageKey> = {
  credit: "wallet.type.credit",
  debit: "wallet.type.debit",
  fine: "wallet.type.fine",
  payout: "wallet.type.payout",
};

type DeveloperForm = {
  fineAmount: string;
  fineReason: string;
  payoutAmount: string;
  payoutReference: string;
};

function centsFromRupees(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0") || "0");
  return cents > 0n && cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}

function rupeesFromCents(cents: string | null): string {
  if (cents === null) return "";
  const value = BigInt(cents);
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}

function formatMoney(cents: string | null, currency: string): string {
  return cents === null ? "—" : formatWalletAmount(cents, currency);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const emptyForm: DeveloperForm = {
  fineAmount: "",
  fineReason: "",
  payoutAmount: "",
  payoutReference: "",
};

export function FinanceDashboard() {
  const { t, formatDate } = useTranslation();
  const queryClient = useQueryClient();
  const { userId, loading: sessionLoading } = useSupabaseSession();
  const permissions = useMyPermissions(userId);
  const canManageFinance =
    !sessionLoading && !permissions.isLoading && permissions.roles.includes("finance_manager");
  const fetchWallets = useServerFn(listDeveloperWallets);
  const fetchDuePayments = useServerFn(listDueTaskPayments);
  const createWalletFn = useServerFn(createWallet);
  const debitFineFn = useServerFn(debitFine);
  const payoutFn = useServerFn(payout);
  const listTransactionsFn = useServerFn(listTransactions);
  const setTaskAmountFn = useServerFn(setTaskAmount);
  const markPaidFn = useServerFn(markPaid);
  const [forms, setForms] = useState<Record<string, DeveloperForm>>({});
  const [taskAmounts, setTaskAmounts] = useState<Record<string, string>>({});
  const [paymentReferences, setPaymentReferences] = useState<Record<string, string>>({});
  const [selectedDeveloper, setSelectedDeveloper] = useState<string | null>(null);

  const wallets = useQuery<DeveloperWalletSummaryDTO[]>({
    queryKey: ["finance-developer-wallets"],
    queryFn: () => fetchWallets(),
    enabled: canManageFinance,
    retry: false,
  });
  const duePayments = useQuery<DueTaskPaymentDTO[]>({
    queryKey: ["finance-due-task-payments"],
    queryFn: () => fetchDuePayments(),
    enabled: canManageFinance,
    refetchInterval: 60_000,
    retry: false,
  });
  const transactions = useQuery<WalletTransactionDTO[]>({
    queryKey: ["finance-wallet-transactions", selectedDeveloper],
    queryFn: () =>
      listTransactionsFn({
        data: { developerId: selectedDeveloper!, limit: 100 },
      }),
    enabled: canManageFinance && Boolean(selectedDeveloper),
    retry: false,
  });

  const invalidateFinanceData = () => {
    void queryClient.invalidateQueries({ queryKey: ["finance-developer-wallets"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-due-task-payments"] });
    void queryClient.invalidateQueries({ queryKey: ["finance-wallet-transactions"] });
  };
  const reportSuccess = () => {
    toast.success(t("wallet.action_success"));
    invalidateFinanceData();
  };
  const reportFailure = (error: unknown) => toast.error(t("wallet.action_error", { error: errorMessage(error) }));

  const createWalletMutation = useMutation({
    mutationFn: (developerId: string) => createWalletFn({ data: { developerId } }),
    onSuccess: reportSuccess,
    onError: reportFailure,
  });
  const fineMutation = useMutation({
    mutationFn: (input: { developerId: string; amountCents: number; reason: string }) =>
      debitFineFn({ data: input }),
    onSuccess: reportSuccess,
    onError: reportFailure,
  });
  const payoutMutation = useMutation({
    mutationFn: (input: { developerId: string; amountCents: number; ref: string }) =>
      payoutFn({ data: input }),
    onSuccess: reportSuccess,
    onError: reportFailure,
  });
  const amountMutation = useMutation({
    mutationFn: (input: { taskId: string; amountCents: number }) =>
      setTaskAmountFn({ data: input }),
    onSuccess: reportSuccess,
    onError: reportFailure,
  });
  const markPaidMutation = useMutation({
    mutationFn: (input: { taskId: string; ref: string }) => markPaidFn({ data: input }),
    onSuccess: reportSuccess,
    onError: reportFailure,
  });

  const updateDeveloperForm = (developerId: string, patch: Partial<DeveloperForm>) => {
    setForms((previous) => ({
      ...previous,
      [developerId]: { ...emptyForm, ...previous[developerId], ...patch },
    }));
  };

  const applyFine = (developerId: string) => {
    const form = forms[developerId] ?? emptyForm;
    const amountCents = centsFromRupees(form.fineAmount);
    if (amountCents === null || !form.fineReason.trim()) {
      toast.error(t("wallet.amount_and_reason_required"));
      return;
    }
    fineMutation.mutate({ developerId, amountCents, reason: form.fineReason.trim() });
  };

  const makePayout = (developerId: string) => {
    const form = forms[developerId] ?? emptyForm;
    const amountCents = centsFromRupees(form.payoutAmount);
    if (amountCents === null || !form.payoutReference.trim()) {
      toast.error(t("wallet.payout_reference_required"));
      return;
    }
    payoutMutation.mutate({
      developerId,
      amountCents,
      ref: form.payoutReference.trim(),
    });
  };

  const saveTaskAmount = (task: DueTaskPaymentDTO) => {
    const amountCents = centsFromRupees(taskAmounts[task.id] ?? rupeesFromCents(task.amount_cents));
    if (amountCents === null) {
      toast.error(t("wallet.positive_amount"));
      return;
    }
    amountMutation.mutate({ taskId: task.id, amountCents });
  };

  const payTask = (task: DueTaskPaymentDTO) => {
    const currentAmount = centsFromRupees(taskAmounts[task.id] ?? rupeesFromCents(task.amount_cents));
    const savedAmount = task.amount_cents === null ? null : BigInt(task.amount_cents);
    const reference = paymentReferences[task.id]?.trim();
    if (
      savedAmount === null ||
      currentAmount === null ||
      BigInt(currentAmount) !== savedAmount
    ) {
      toast.error(t("wallet.amount_missing"));
      return;
    }
    if (!reference) {
      toast.error(t("wallet.payment_reference_required"));
      return;
    }
    markPaidMutation.mutate({ taskId: task.id, ref: reference });
  };

  const sharedDisabled = !canManageFinance;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {t("wallet.finance_title")}
        </p>
        <h1 className="text-2xl font-bold">{t("wallet.developers")}</h1>
      </header>

      {!canManageFinance ? (
        <p className="text-sm text-muted-foreground" role="status" aria-busy>
          {sessionLoading || permissions.isLoading ? t("wallet.loading") : t("wallet.finance_only")}
        </p>
      ) : (
        <>
          {wallets.isLoading || duePayments.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status" aria-busy>
              {t("wallet.loading")}
            </p>
          ) : null}
          {wallets.error ? (
            <p className="text-sm text-destructive" role="alert">
              {t("wallet.load_error", { error: errorMessage(wallets.error) })}
            </p>
          ) : null}
          {duePayments.error ? (
            <p className="text-sm text-destructive" role="alert">
              {t("wallet.load_error", { error: errorMessage(duePayments.error) })}
            </p>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                {t("wallet.developers")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(wallets.data ?? []).length === 0 && !wallets.isLoading && !wallets.error ? (
                <p className="text-sm text-muted-foreground">{t("wallet.no_developers")}</p>
              ) : null}
              {(wallets.data ?? []).map((developer) => {
                const form = forms[developer.developer_id] ?? emptyForm;
                const label = developer.email ?? developer.developer_id;
                return (
                  <section key={developer.developer_id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{label}</h2>
                        <p className="text-sm text-muted-foreground">
                          {t("wallet.balance")}:{" "}
                          {formatMoney(developer.balance_cents ?? "0", developer.currency ?? "INR")}
                        </p>
                      </div>
                      {developer.wallet_id ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={sharedDisabled}
                          onClick={() =>
                            setSelectedDeveloper((current) =>
                              current === developer.developer_id ? null : developer.developer_id,
                            )
                          }
                        >
                          <Eye className="h-4 w-4" />
                          {selectedDeveloper === developer.developer_id
                            ? t("wallet.close_transactions")
                            : t("wallet.view_transactions")}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={sharedDisabled || createWalletMutation.isPending}
                          onClick={() => createWalletMutation.mutate(developer.developer_id)}
                        >
                          {t("wallet.create")}
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2 rounded-md bg-muted/30 p-3">
                        <label className="text-sm font-medium" htmlFor={`fine-amount-${developer.developer_id}`}>
                          {t("wallet.fine_amount")}
                        </label>
                        <Input
                          id={`fine-amount-${developer.developer_id}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.fineAmount}
                          onChange={(event) =>
                            updateDeveloperForm(developer.developer_id, { fineAmount: event.target.value })
                          }
                        />
                        <label className="text-sm font-medium" htmlFor={`fine-reason-${developer.developer_id}`}>
                          {t("wallet.fine_reason")}
                        </label>
                        <Input
                          id={`fine-reason-${developer.developer_id}`}
                          value={form.fineReason}
                          onChange={(event) =>
                            updateDeveloperForm(developer.developer_id, { fineReason: event.target.value })
                          }
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={sharedDisabled || fineMutation.isPending || !developer.wallet_id}
                          onClick={() => applyFine(developer.developer_id)}
                        >
                          {t("wallet.debit_fine")}
                        </Button>
                      </div>

                      <div className="space-y-2 rounded-md bg-muted/30 p-3">
                        <label className="text-sm font-medium" htmlFor={`payout-amount-${developer.developer_id}`}>
                          {t("wallet.payout_amount")}
                        </label>
                        <Input
                          id={`payout-amount-${developer.developer_id}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.payoutAmount}
                          onChange={(event) =>
                            updateDeveloperForm(developer.developer_id, { payoutAmount: event.target.value })
                          }
                        />
                        <label className="text-sm font-medium" htmlFor={`payout-reference-${developer.developer_id}`}>
                          {t("wallet.payout_reference")}
                        </label>
                        <Input
                          id={`payout-reference-${developer.developer_id}`}
                          value={form.payoutReference}
                          onChange={(event) =>
                            updateDeveloperForm(developer.developer_id, { payoutReference: event.target.value })
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={sharedDisabled || payoutMutation.isPending || !developer.wallet_id}
                          onClick={() => makePayout(developer.developer_id)}
                        >
                          {t("wallet.payout")}
                        </Button>
                      </div>
                    </div>

                    {selectedDeveloper === developer.developer_id ? (
                      <div className="space-y-2 border-t pt-3">
                        {transactions.isLoading ? (
                          <p className="text-sm text-muted-foreground" role="status" aria-busy>
                            {t("wallet.loading")}
                          </p>
                        ) : transactions.error ? (
                          <p className="text-sm text-destructive" role="alert">
                            {t("wallet.load_error", { error: errorMessage(transactions.error) })}
                          </p>
                        ) : (transactions.data ?? []).length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t("wallet.no_transactions")}</p>
                        ) : (
                          <>
                            <div className="grid gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground sm:grid-cols-4">
                              <span>{t("wallet.transaction_type")}</span>
                              <span>{t("wallet.transaction_amount")}</span>
                              <span>{t("wallet.transaction_note")}</span>
                              <span>{t("wallet.transaction_date")}</span>
                            </div>
                            {(transactions.data ?? []).map((transaction) => (
                              <div key={transaction.id} className="grid gap-2 text-sm sm:grid-cols-4">
                                <span>{t(transactionLabels[transaction.type])}</span>
                                <span>
                                  {formatMoney(transaction.amount_cents, developer.currency ?? "INR")}
                                </span>
                                <span>{transaction.note ?? transaction.reference ?? "—"}</span>
                                <time dateTime={transaction.created_at}>
                                  {formatDate(transaction.created_at)}
                                </time>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {t("wallet.payment_queue")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(duePayments.data ?? []).length === 0 && !duePayments.isLoading && !duePayments.error ? (
                <p className="text-sm text-muted-foreground">{t("wallet.no_due_tasks")}</p>
              ) : null}
              {(duePayments.data ?? []).map((task) => {
                const amountInput = taskAmounts[task.id] ?? rupeesFromCents(task.amount_cents);
                const savedAmount = task.amount_cents === null ? null : BigInt(task.amount_cents);
                const parsedAmount = centsFromRupees(amountInput);
                return (
                  <section key={task.id} className="space-y-3 rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{task.title}</h2>
                        <p className="text-xs text-muted-foreground">
                          {t("wallet.developer")}: {task.developer_email ?? task.developer_id} ·{" "}
                          {t("wallet.status")}: {task.payment_status}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("wallet.due_at")}: {task.due_at ? formatDate(task.due_at) : "—"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold">{formatMoney(task.amount_cents, "INR")}</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
                      <label className="sr-only" htmlFor={`task-amount-${task.id}`}>
                        {t("wallet.task_amount")}
                      </label>
                      <Input
                        id={`task-amount-${task.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amountInput}
                        onChange={(event) =>
                          setTaskAmounts((current) => ({ ...current, [task.id]: event.target.value }))
                        }
                        aria-label={t("wallet.task_amount")}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={
                          sharedDisabled ||
                          amountMutation.isPending ||
                          parsedAmount === null ||
                          (savedAmount !== null && BigInt(parsedAmount) === savedAmount)
                        }
                        onClick={() => saveTaskAmount(task)}
                      >
                        {t("wallet.save_amount")}
                      </Button>
                      <Input
                        value={paymentReferences[task.id] ?? ""}
                        onChange={(event) =>
                          setPaymentReferences((current) => ({ ...current, [task.id]: event.target.value }))
                        }
                        placeholder={t("wallet.payment_reference")}
                        aria-label={t("wallet.payment_reference")}
                      />
                      <Button
                        type="button"
                        disabled={
                          sharedDisabled ||
                          markPaidMutation.isPending ||
                          savedAmount === null ||
                          parsedAmount === null ||
                          BigInt(parsedAmount) !== savedAmount ||
                          !paymentReferences[task.id]?.trim()
                        }
                        onClick={() => payTask(task)}
                      >
                        {t("wallet.mark_paid")}
                      </Button>
                    </div>
                  </section>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}

export default FinanceDashboard;
