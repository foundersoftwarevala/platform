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

function view(): string {
  if (typeof window === "undefined") return "billing";
  const asked = new URLSearchParams(window.location.search).get("view") ?? "";
  return ["billing", "wallet", "audit"].includes(asked) ? asked : "billing";
}

export const Route = createFileRoute("/finance-manager")({
  head: () => ({ meta: [{ title: "Finance Manager — Software Vala" }] }),
  component: () => <FinanceManager view={view()} />,
});
