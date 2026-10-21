import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSupabaseSession } from "@/hooks/use-session";
import { useTranslation } from "@/lib/i18n/use-translation";
import { formatWalletAmount } from "@/lib/wallet/format";
import { getWallet, listTransactions } from "@/lib/wallet/functions";
import type { MessageKey } from "@/lib/i18n/messages";
import type { WalletTransactionDTO, WalletTransactionType } from "@/lib/wallet/types";

const transactionLabels: Record<WalletTransactionType, MessageKey> = {
  credit: "wallet.type.credit",
  debit: "wallet.type.debit",
  fine: "wallet.type.fine",
  payout: "wallet.type.payout",
};

export const DMWallet: React.FC = () => {
  const { t, formatDate } = useTranslation();
  const { userId, loading: sessionLoading } = useSupabaseSession();
  const fetchWallet = useServerFn(getWallet);
  const fetchTransactions = useServerFn(listTransactions);
  const wallet = useQuery({
    queryKey: ["developer-wallet", userId],
    queryFn: () => fetchWallet({ data: {} }),
    enabled: !sessionLoading && Boolean(userId),
    refetchInterval: 60_000,
  });
  const transactions = useQuery({
    queryKey: ["developer-wallet-transactions", userId],
    queryFn: () => fetchTransactions({ data: { limit: 100 } }),
    enabled: !sessionLoading && Boolean(userId),
    refetchInterval: 60_000,
  });

  const loading = sessionLoading || wallet.isLoading || transactions.isLoading;
  const error = wallet.error ?? transactions.error;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t("wallet.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("wallet.no_payout")}</p>
      </div>
      {sessionLoading || !userId || loading || error ? (
        <p
          className="text-sm text-muted-foreground"
          role={error || (!sessionLoading && !userId) ? "alert" : "status"}
          aria-busy={loading || undefined}
        >
          {!sessionLoading && !userId
            ? t("wallet.sign_in")
            : loading
            ? t("wallet.loading")
            : t("wallet.load_error", { error: error instanceof Error ? error.message : String(error) })}
        </p>
      ) : (
        <>
          {wallet.data ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  {t("wallet.balance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold">
                {formatWalletAmount(wallet.data.balance_cents, wallet.data.currency)}
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">{t("wallet.empty")}</p>
          )}
          <Card>
            <CardHeader>
              <CardTitle>{t("wallet.transactions")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactions.data?.length ? (
                <>
                  <div className="grid gap-2 border-b pb-2 text-xs font-semibold text-muted-foreground sm:grid-cols-4">
                    <span>{t("wallet.transaction_type")}</span>
                    <span>{t("wallet.transaction_amount")}</span>
                    <span>{t("wallet.transaction_note")}</span>
                    <span>{t("wallet.transaction_date")}</span>
                  </div>
                  {transactions.data.map((transaction: WalletTransactionDTO) => (
                    <div key={transaction.id} className="grid gap-2 border-b pb-3 text-sm sm:grid-cols-4">
                      <span>{t(transactionLabels[transaction.type])}</span>
                      <span>
                        {formatWalletAmount(transaction.amount_cents, wallet.data?.currency ?? "INR")}
                      </span>
                      <span className="break-words">{transaction.note ?? transaction.reference ?? "—"}</span>
                      <time dateTime={transaction.created_at}>{formatDate(transaction.created_at)}</time>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{t("wallet.no_transactions")}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DMWallet;
