import type { FinanceView } from "@/lib/finance/views";
import RevenueDashboard from "@/components/finance/consoles/RevenueDashboard";
import PayoutManager from "@/components/finance/consoles/PayoutManager";
import WalletSystem from "@/components/finance/consoles/WalletSystem";
import CommissionLedger from "@/components/finance/consoles/CommissionLedger";
import InvoiceCenter from "@/components/finance/consoles/InvoiceCenter";
import TransactionHeatmap from "@/components/finance/consoles/TransactionHeatmap";
import FraudScanner from "@/components/finance/consoles/FraudScanner";
import AuditLogs from "@/components/finance/consoles/AuditLogs";

export default function ConsoleSections({ view }: { view: FinanceView }) {
  switch (view) {
    case "payouts":
      return <PayoutManager />;
    case "wallets":
      return <WalletSystem />;
    case "commissions":
      return <CommissionLedger />;
    case "invoices":
      return <InvoiceCenter />;
    case "heatmap":
      return <TransactionHeatmap />;
    case "fraud":
      return <FraudScanner />;
    case "audit":
      return <AuditLogs />;
    case "revenue":
    default:
      return <RevenueDashboard />;
  }
}
