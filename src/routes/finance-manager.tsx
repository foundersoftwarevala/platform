import { createFileRoute } from "@tanstack/react-router";
import { FinanceManager } from "@/components/finance/FinanceManager";

/**
 * Finance Manager.
 *
 * The Control Panel has offered this in its sidebar all along, but the entry
 * had nowhere to go: the module map listed eleven managers and not this one, so
 * choosing Finance Manager fell through to a message and stayed where it was.
 * The screens themselves were already built - billing, wallet and audit - and
 * this gives them the address the sidebar was already pointing people at.
 *
 * ?view=wallet or ?view=audit opens straight onto that screen, so a link can
 * name the part of the module it means.
 */

/**
 * The module now names its own views — overview_total_balance, wallet_master,
 * log_activity and the rest — so ?view= is passed straight through and the
 * module decides whether it knows the name. The three names this route used to
 * accept still work: they map onto their equivalents so older links keep
 * landing somewhere sensible instead of silently opening the default.
 */
const LEGACY_VIEWS: Record<string, string> = {
  billing: "invoice_generate",
  wallet: "wallet_master",
  audit: "log_activity",
};

function view(): string {
  if (typeof window === "undefined") return "overview_total_balance";
  const asked = new URLSearchParams(window.location.search).get("view") ?? "";
  return LEGACY_VIEWS[asked] ?? asked;
}

export const Route = createFileRoute("/finance-manager")({
  head: () => ({ meta: [{ title: "Finance Manager — Software Vala" }] }),
  component: () => <FinanceManager view={view()} />,
});
