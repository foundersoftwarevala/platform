import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Scale } from "lucide-react";

import { reconciliationQuery } from "@/lib/finance/queries";
import {
  PanelCard,
  QueryState,
  SectionShell,
  StatCard,
  StatGrid,
  StatusBadge,
} from "@/components/finance/ui-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/finance/format";

/**
 * Payment reconciliation.
 *
 * Every provider event that reaches the webhook is written down here alongside
 * what our own records said it should be — the payment reference, the order,
 * the amount and the currency we expected against the ones the provider
 * reported. A payment that lines up is marked matched and can be traced from
 * the provider's transaction through to the ledger entry. One that does not
 * becomes an exception.
 *
 * The exceptions are the point of the screen. Before this they were lines in
 * payment_logs that nobody read, so an amount mismatch or a callback for an
 * unknown reference simply disappeared. Nothing here is calculated in the
 * browser and nothing is inferred; every row is what the server recorded at the
 * moment the event arrived.
 */

type Row = Record<string, unknown>;

const OUTCOME_LABEL: Record<string, string> = {
  matched: "Matched",
  amount_mismatch: "Amount mismatch",
  currency_mismatch: "Currency mismatch",
  gateway_mismatch: "Wrong gateway",
  unmatched_provider_payment: "Unmatched provider payment",
  missing_transaction: "Missing transaction",
  duplicate_event: "Duplicate event",
  missing_webhook: "Missing webhook",
  refund_mismatch: "Refund mismatch",
};

/** Anything the provider and our books did not agree on. */
function isException(row: Row): boolean {
  return String(row["matching_status"] ?? "") !== "matched";
}

export default function ReconciliationSection() {
  const [exceptionsOnly, setExceptionsOnly] = useState(true);
  const state = useQuery(reconciliationQuery(exceptionsOnly ? "exceptions" : undefined));
  const rows = useMemo(() => (state.data ?? []) as Row[], [state.data]);

  const allState = useQuery(reconciliationQuery());
  const all = useMemo(() => (allState.data ?? []) as Row[], [allState.data]);
  const exceptionCount = all.filter(isException).length;
  const openCount = all.filter((row) => isException(row) && !row["resolved_at"]).length;

  return (
    <SectionShell
      title="Payment Reconciliation"
      description="Every gateway payment matched against the order, the ledger and the provider"
      icon={Scale}
    >
      <StatGrid>
        <StatCard label="Events recorded" value={String(all.length)} tone="info" />
        <StatCard
          label="Matched"
          value={String(all.length - exceptionCount)}
          icon={CheckCircle}
          tone="success"
        />
        <StatCard
          label="Exceptions"
          value={String(exceptionCount)}
          icon={AlertTriangle}
          tone={exceptionCount ? "warning" : "default"}
        />
        <StatCard
          label="Open exceptions"
          value={String(openCount)}
          tone={openCount ? "warning" : "success"}
        />
      </StatGrid>

      <div className="mt-6">
        <PanelCard
          title={exceptionsOnly ? "Exceptions" : "All reconciliation events"}
          actions={
            <Button variant="outline" size="sm" onClick={() => setExceptionsOnly((v) => !v)}>
              {exceptionsOnly ? "Show everything" : "Show exceptions only"}
            </Button>
          }
        >
          <QueryState
            isLoading={state.isLoading}
            error={state.error}
            isEmpty={rows.length === 0}
            emptyLabel={
              exceptionsOnly
                ? "No reconciliation exceptions. Every gateway payment matched."
                : "No gateway payments have been reconciled yet."
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Reference</th>
                    <th className="pb-2 font-medium">Provider</th>
                    <th className="pb-2 font-medium">Outcome</th>
                    <th className="pb-2 font-medium">Expected</th>
                    <th className="pb-2 font-medium">Observed</th>
                    <th className="pb-2 font-medium">Detail</th>
                    <th className="pb-2 font-medium">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const outcome = String(row["matching_status"] ?? "");
                    const exception = isException(row);
                    return (
                      <tr key={String(row["id"])}>
                        <td className="py-2 font-mono text-xs text-primary">
                          {String(row["reference"] ?? "—")}
                        </td>
                        <td className="py-2 capitalize text-foreground">
                          {String(row["rail_code"] ?? "—")}
                        </td>
                        <td className="py-2">
                          {exception ? (
                            <Badge
                              variant="outline"
                              className="border-status-warning/40 text-status-warning"
                            >
                              {OUTCOME_LABEL[outcome] ?? outcome}
                            </Badge>
                          ) : (
                            <StatusBadge status="matched" />
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {row["expected_amount"] != null
                            ? `${row["expected_currency"] ?? ""} ${row["expected_amount"]}`
                            : "—"}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {row["observed_amount"] != null
                            ? `${row["observed_currency"] ?? ""} ${row["observed_amount"]}`
                            : "—"}
                        </td>
                        <td className="py-2 max-w-sm text-xs text-muted-foreground">
                          {String(row["detail"] ?? "")}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {formatDateTime(String(row["created_at"] ?? ""))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </PanelCard>
      </div>
    </SectionShell>
  );
}
