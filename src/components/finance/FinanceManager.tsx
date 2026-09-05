import { useState } from "react";
import BillingScreen from "@/components/manager/screens/BillingScreen";
import WalletScreen from "@/components/manager/screens/WalletScreen";
import AuditScreen from "@/components/manager/screens/AuditScreen";
import { Button } from "@/components/ui/button";

export function FinanceManager({ view = "billing" }: { view?: string }) {
  const [activeView, setActiveView] = useState(view);
  const Screen = activeView === "wallet" ? WalletScreen : activeView === "audit" ? AuditScreen : BillingScreen;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
        <Button type="button" variant={activeView === "billing" ? "default" : "outline"} onClick={() => setActiveView("billing")}>Billing</Button>
        <Button type="button" variant={activeView === "wallet" ? "default" : "outline"} onClick={() => setActiveView("wallet")}>Wallet</Button>
        <Button type="button" variant={activeView === "audit" ? "default" : "outline"} onClick={() => setActiveView("audit")}>Audit</Button>
      </div>
      <Screen view={activeView} />
    </div>
  );
}
