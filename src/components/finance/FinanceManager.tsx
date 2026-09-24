import { Toaster } from "@/components/ui/sonner";
import { useState } from "react";
import BillingScreen from "@/components/manager/screens/BillingScreen";
import WalletScreen from "@/components/manager/screens/WalletScreen";
import AuditScreen from "@/components/manager/screens/AuditScreen";
import { ResellerMembershipQueue } from "@/components/finance/ResellerMembershipQueue";
import { FinanceLedger } from "@/components/finance/FinanceLedger";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

export function FinanceManager({ view = "billing" }: { view?: string }) {
  const { t } = useTranslation();
  const [activeView, setActiveView] = useState(view);
  const Screen = activeView === "wallet" ? WalletScreen : activeView === "audit" ? AuditScreen : BillingScreen;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster />
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        <Button type="button" variant={activeView === "billing" ? "default" : "outline"} onClick={() => setActiveView("billing")}>Billing</Button>
        <Button type="button" variant={activeView === "memberships" ? "default" : "outline"} onClick={() => setActiveView("memberships")}>{t("reseller.queue.tab")}</Button>
        <Button type="button" variant={activeView === "wallet" ? "default" : "outline"} onClick={() => setActiveView("wallet")}>Wallet</Button>
        <Button type="button" variant={activeView === "audit" ? "default" : "outline"} onClick={() => setActiveView("audit")}>Audit</Button>
        {/*
          The three screens beside this one read the API-billing tables, which
          are empty. The ledger reads the finance tables, which are not.
        */}
        <Button type="button" variant={activeView === "ledger" ? "default" : "outline"} onClick={() => setActiveView("ledger")}>Ledger</Button>
      </div>
      {activeView === "memberships" ? (
        <ResellerMembershipQueue />
      ) : activeView === "ledger" ? (
        <FinanceLedger />
      ) : (
        <Screen view={activeView} />
      )}
    </div>
  );
}
