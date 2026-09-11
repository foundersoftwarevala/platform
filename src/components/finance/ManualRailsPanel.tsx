import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import {
  confirmManualPaymentFn,
  manualRailSettingsFn,
  saveManualRailSettingsFn,
} from "@/lib/finance/finance.functions";
import { PanelCard, QueryState } from "@/components/finance/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/**
 * Where Finance switches on the rails a person settles, and confirms the
 * payments that arrive on them.
 *
 * Checkout offers Wise, bank transfer, UPI and Binance only when the rail is
 * enabled here, and gives the customer this pay link and these instructions
 * with their order's reference. Before this panel there was no control for any
 * of it - the screen above said "not enabled in Finance Manager" and nothing in
 * Finance Manager could enable it - and a customer who did pay by hand left an
 * order that nothing could ever mark paid.
 *
 * Bank details follow the platform rule: only the account name and the bank
 * name are kept in full; of the account number, only the last four characters.
 */

type Rail = {
  code: "wise" | "upi" | "bank_transfer" | "binance";
  displayName: string;
  enabled: boolean;
  payLink: string;
  instructions: string;
  accountName: string;
  bankName: string;
  accountLast4: string;
};

const QUERY_KEY = ["finance", "manual-rail-settings"] as const;

function RailEditor({ rail }: { rail: Rail }) {
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveManualRailSettingsFn);
  const [payLink, setPayLink] = useState(rail.payLink);
  const [instructions, setInstructions] = useState(rail.instructions);
  const [accountName, setAccountName] = useState(rail.accountName);
  const [bankName, setBankName] = useState(rail.bankName);
  const [accountLast4, setAccountLast4] = useState(rail.accountLast4);

  useEffect(() => {
    setPayLink(rail.payLink);
    setInstructions(rail.instructions);
    setAccountName(rail.accountName);
    setBankName(rail.bankName);
    setAccountLast4(rail.accountLast4);
  }, [rail.payLink, rail.instructions, rail.accountName, rail.bankName, rail.accountLast4]);

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      saveFn({ data: { code: rail.code, ...input } } as never),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // The masked receiving details above read the same rail rows.
      queryClient.invalidateQueries({ queryKey: ["manager"] });
      toast.success(`${rail.displayName} saved.`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isBank = rail.code === "bank_transfer";
  const fields = {
    payLink,
    instructions,
    ...(isBank ? { accountName, bankName, accountLast4 } : {}),
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-foreground">{rail.displayName}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {rail.enabled ? "Offered at checkout" : "Not offered"}
          </span>
          <Switch
            checked={rail.enabled}
            disabled={save.isPending}
            onCheckedChange={(checked) => save.mutate({ ...fields, enabled: checked })}
            aria-label={`Offer ${rail.displayName} at checkout`}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Pay link {rail.code === "wise" ? "(required)" : "(optional)"}
          </span>
          <Input
            value={payLink}
            onChange={(e) => setPayLink(e.target.value)}
            placeholder="https://"
            inputMode="url"
          />
        </label>
        <label className="space-y-1.5 sm:col-span-2">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Instructions shown to the customer
          </span>
          <Input
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Pay the amount using the order reference, then reply on WhatsApp."
          />
        </label>
        {isBank ? (
          <>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Account name
              </span>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Bank name
              </span>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </label>
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Account number — last 4 only
              </span>
              <Input
                value={accountLast4}
                maxLength={4}
                onChange={(e) => setAccountLast4(e.target.value)}
              />
            </label>
          </>
        ) : null}
      </div>
      <div className="flex justify-end">
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(fields)}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

function ConfirmManualPayment() {
  const confirmFn = useServerFn(confirmManualPaymentFn);
  const queryClient = useQueryClient();
  const [reference, setReference] = useState("");
  const [transactionId, setTransactionId] = useState("");
  // The amount that arrived, read off the statement. The server compares it
  // with the order and refuses a short payment instead of settling it in full.
  const [amount, setAmount] = useState("");
  const amountValue = Number(amount.replace(/,/g, ""));
  const amountValid = amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0;

  const confirm = useMutation({
    mutationFn: () =>
      confirmFn({
        data: {
          reference: reference.trim(),
          transactionId: transactionId.trim(),
          amount: amountValue,
        },
      } as never) as Promise<{ data: { orderNumber: string; replay: boolean } }>,
    onSuccess: (result) => {
      const order = result?.data?.orderNumber ?? "The order";
      toast.success(
        result?.data?.replay ? `${order} was already paid.` : `${order} is now paid and licensed.`,
      );
      setReference("");
      setTransactionId("");
      setAmount("");
      queryClient.invalidateQueries({ queryKey: ["manager"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <PanelCard title="Confirm a manual payment">
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Only after the money is seen in the receiving account. Enter the order's payment reference
          (the customer was given it at checkout), the transaction id from Wise, the bank
          statement, UPI or Binance, and the amount that arrived in the order's currency. The amount
          is checked against the order before it is settled, a transaction id can pay only one
          order, and a second confirmation of the same reference changes nothing.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Order payment reference"
            aria-label="Order payment reference"
          />
          <Input
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Transaction id from the provider"
            aria-label="Transaction id from the provider"
          />
          <Input
            value={amount}
            inputMode="decimal"
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount received (e.g. 249.00)"
            aria-label="Amount received, in the order's currency"
          />
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={
              confirm.isPending ||
              !reference.trim() ||
              transactionId.trim().length < 4 ||
              !amountValid
            }
            onClick={() => confirm.mutate()}
          >
            {confirm.isPending ? "Confirming…" : "Confirm payment received"}
          </Button>
        </div>
      </div>
    </PanelCard>
  );
}

export default function ManualRailsPanel() {
  const settingsFn = useServerFn(manualRailSettingsFn);
  const state = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => settingsFn() as Promise<Rail[]>,
    staleTime: 30_000,
  });
  const rails = state.data ?? [];

  return (
    <div className="space-y-6">
      <PanelCard title="Payment methods offered at checkout">
        <QueryState
          isLoading={state.isLoading}
          error={state.error}
          isEmpty={rails.length === 0}
          emptyLabel="No manual payment rail exists."
        >
          <div className="space-y-3">
            {rails.map((rail) => (
              <RailEditor key={rail.code} rail={rail} />
            ))}
          </div>
        </QueryState>
      </PanelCard>
      <ConfirmManualPayment />
    </div>
  );
}
