import { createFileRoute } from "@tanstack/react-router";
import { Wallet, DollarSign } from "lucide-react";
import { EntityWall, Row, Cell, fmtMoney } from "@/components/affiliate/EntityWall";

type WalletRow = { id: string; affiliate_id: string; balance_cents: number; currency: string; updated_at: string };

export const Route = createFileRoute("/affiliate-manager/wallet")({
  head: () => ({ meta: [{ title: "Wallet — Affiliate Manager" }] }),
  component: () => (
    <EntityWall<WalletRow>
      title="Wallet"
      description="Every affiliate wallet with balance, credits, debits and settlement history."
      crumbLabel="Wallet"
      table="wallets"
      searchColumns={[]}
      searchPlaceholder="Search wallets…"
      filters={["Currency", "Balance", "Affiliate"]}
      order={{ column: "balance_cents", ascending: false }}
      kpis={[
        { label: "Wallets", icon: <Wallet className="size-4" />, tone: "primary" },
        { label: "Currencies", icon: <DollarSign className="size-4" /> },
      ]}
      columns={[
        { key: "aff", label: "Affiliate" },
        { key: "bal", label: "Balance", align: "right" },
        { key: "cur", label: "Currency" },
      ]}
      renderRow={(w) => (
        <Row id={w.id}>
          <Cell className="font-mono text-[11px] text-muted-foreground">{w.affiliate_id.slice(0, 8)}</Cell>
          <Cell align="right" className="tabular-nums">{fmtMoney(w.balance_cents)}</Cell>
          <Cell>{w.currency}</Cell>
        </Row>
      )}
      emptyIcon={Wallet}
      emptyTitle="No wallets"
      emptyDescription="Approved affiliates automatically get a wallet for credits, debits and settlements."
    />
  ),
});
