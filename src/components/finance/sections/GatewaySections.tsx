import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Smartphone,
  Landmark,
  CreditCard,
  DollarSign,
  Bitcoin,
  Activity,
  type LucideIcon,
} from "lucide-react";

import { gatewaysQuery, transactionsQuery } from "@/lib/finance/queries";
import { useToggleGateway } from "@/lib/finance/mutations";
import type { FinanceView } from "@/lib/finance/views";
import { PanelCard, QueryState, SectionShell, StatCard, StatGrid, StatusBadge } from "@/components/finance/ui-kit";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { formatCompact, formatDateTime, formatPercent } from "@/lib/finance/format";

const GATEWAY_META: Record<string, { code: string; label: string; icon: LucideIcon }> = {
  gateway_upi: { code: "upi", label: "UPI Gateway", icon: Smartphone },
  gateway_bank: { code: "bank", label: "Bank Transfer", icon: Landmark },
  gateway_payu: { code: "payu", label: "PayU Gateway", icon: CreditCard },
  gateway_stripe: { code: "stripe", label: "Stripe Gateway", icon: CreditCard },
  gateway_paypal: { code: "paypal", label: "PayPal Gateway", icon: DollarSign },
  gateway_crypto: { code: "crypto", label: "Crypto (Binance/USDT)", icon: Bitcoin },
};

export default function GatewaySections({ view }: { view: FinanceView }) {
  const meta = GATEWAY_META[view] ?? GATEWAY_META['gateway_upi']!;
  const gatewaysState = useQuery(gatewaysQuery());
  const gateway = useMemo(
    () => gatewaysState.data?.find((g) => g.code === meta.code),
    [gatewaysState.data, meta.code],
  );
  const txnState = useQuery(transactionsQuery({ gateway: meta.code, limit: 100 }));
  const toggleGateway = useToggleGateway();

  const Icon = meta.icon;

  const txnRows = txnState.data ?? [];
  const volume = useMemo(() => txnRows.reduce((sum, t) => sum + Number(t.amount), 0), [txnRows]);
  const successCount = useMemo(() => txnRows.filter((t) => t.status === "success").length, [txnRows]);
  const successRate = txnRows.length ? (successCount / txnRows.length) * 100 : 0;

  const isEnabled = gateway ? gateway.status !== "inactive" && gateway.status !== "disabled" : false;

  return (
    <SectionShell
      title={meta.label}
      description="Live configuration, health and recent transactions for this payment gateway"
      icon={Icon}
    >
      <QueryState isLoading={gatewaysState.isLoading} error={gatewaysState.error} isEmpty={!gateway} emptyLabel="Gateway not configured yet">
        {gateway ? (
          <div className="space-y-6">
            <StatGrid>
              <StatCard label="Success Rate" value={formatPercent(gateway.success_rate)} icon={Activity} tone="success" />
              <StatCard label="Fee %" value={formatPercent(gateway.fee_percent, 2)} tone="warning" />
              <StatCard label="Monthly Volume" value={formatCompact(gateway.monthly_volume)} tone="info" />
              <StatCard label="Settlement Cycle" value={gateway.settlement_cycle} tone="default" />
            </StatGrid>

            <PanelCard
              title="Configuration"
              actions={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{isEnabled ? "Enabled" : "Disabled"}</span>
                  <Switch
                    checked={isEnabled}
                    disabled={toggleGateway.isPending}
                    onCheckedChange={(checked) =>
                      toggleGateway.mutate({ id: gateway.id, enabled: checked, actor: "finance_manager" })
                    }
                  />
                </div>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Provider</p>
                  <p className="font-medium text-foreground">{gateway.provider}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <StatusBadge status={gateway.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Txns</p>
                  <p className="font-medium text-foreground">{gateway.monthly_txn_count}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Currencies</p>
                  <div className="flex flex-wrap gap-1">
                    {gateway.supported_currencies.map((c) => (
                      <Badge key={c} variant="outline" className="text-xs">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Sync</p>
                  <p className="font-medium text-foreground">{formatDateTime(gateway.last_sync_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sample success rate (recent txns)</p>
                  <p className="font-medium text-foreground">{formatPercent(successRate)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sample volume (recent txns)</p>
                  <p className="font-medium text-foreground">{formatCompact(volume)}</p>
                </div>
              </div>
            </PanelCard>

            <PanelCard title="Recent Transactions">
              <QueryState isLoading={txnState.isLoading} error={txnState.error} isEmpty={txnRows.length === 0} emptyLabel="No transactions for this gateway yet">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b border-border">
                        <th className="pb-2 font-medium">Txn Code</th>
                        <th className="pb-2 font-medium">Counterparty</th>
                        <th className="pb-2 font-medium">Direction</th>
                        <th className="pb-2 font-medium">Amount</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Occurred</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {txnRows.slice(0, 30).map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 font-mono text-primary">{t.txn_code}</td>
                          <td className="py-2 text-foreground">{t.counterparty}</td>
                          <td className="py-2 capitalize text-muted-foreground">{t.direction}</td>
                          <td className="py-2 font-semibold text-foreground">{formatCompact(t.amount)}</td>
                          <td className="py-2">
                            <StatusBadge status={t.status} />
                          </td>
                          <td className="py-2 text-muted-foreground">{formatDateTime(t.occurred_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </PanelCard>
          </div>
        ) : null}
      </QueryState>
    </SectionShell>
  );
}
