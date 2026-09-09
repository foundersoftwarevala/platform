import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Menu, RefreshCcw, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { FinanceSidebar, FINANCE_GROUPS, VIEW_LABELS, useSidebarState } from "./FinanceSidebar";
import { FinanceNotifications } from "./FinanceNotifications";
import type { FinanceView } from "@/lib/finance/views";


import OverviewSections from "./sections/OverviewSections";
import WalletSections from "./sections/WalletSections";
import PaymentSections from "./sections/PaymentSections";
import GatewaySections from "./sections/GatewaySections";
import InvoiceSections from "./sections/InvoiceSections";
import PlanSections from "./sections/PlanSections";
import CommissionSections from "./sections/CommissionSections";
import CostSections from "./sections/CostSections";
import AiBillingSections from "./sections/AiBillingSections";
import RefundSections from "./sections/RefundSections";
import TaxSections from "./sections/TaxSections";
import ReportSections from "./sections/ReportSections";
import AlertSections from "./sections/AlertSections";
import LogSections from "./sections/LogSections";
import ConsoleSections from "./sections/ConsoleSections";

type FinanceGroupId = (typeof FINANCE_GROUPS)[number]["id"];

/** Single source of truth: every group declared in FINANCE_GROUPS must have a renderer. */
const GROUP_COMPONENTS: Record<FinanceGroupId, (props: { view: FinanceView }) => React.ReactElement> = {
  overview: OverviewSections,
  wallet: WalletSections,
  payments: PaymentSections,
  gateways: GatewaySections,
  invoices: InvoiceSections,
  plans: PlanSections,
  commissions: CommissionSections,
  costs: CostSections,
  ai_billing: AiBillingSections,
  refunds: RefundSections,
  tax: TaxSections,
  reports: ReportSections,
  alerts: AlertSections,
  logs: LogSections,
  consoles: ConsoleSections,
};

const MAX_RESULTS = 8;

function FinanceSearch({
  onSelect,
  autoFocus,
  id,
}: {
  onSelect: (view: FinanceView) => void;
  autoFocus?: boolean;
  id: string;
}) {
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listId = `${id}-results`;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return FINANCE_GROUPS.flatMap((g) =>
      g.items
        .filter((i) => i.label.toLowerCase().includes(q) || g.label.toLowerCase().includes(q))
        .map((i) => ({ ...i, group: g.label })),
    );
  }, [search]);

  const results = matches.slice(0, MAX_RESULTS);
  const hidden = matches.length - results.length;

  useEffect(() => setHighlight(0), [search]);

  const choose = (view: FinanceView) => {
    setSearch("");
    onSelect(view);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        id={id}
        value={search}
        autoFocus={autoFocus}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h - 1 + results.length) % results.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const target = results[highlight];
            if (target) choose(target.id);
          } else if (e.key === "Escape") {
            setSearch("");
          }
        }}
        placeholder="Search finance modules"
        aria-label="Search finance modules"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results.length ? `${listId}-${highlight}` : undefined}
        className="w-full pl-9 md:w-64"
      />
      <p className="sr-only" aria-live="polite">
        {search.trim() ? `${matches.length} matching finance modules` : ""}
      </p>
      {results.length > 0 ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Finance module search results"
          className="absolute right-0 top-full z-30 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg md:w-80"
        >
          {results.map((r, index) => (
            <button
              key={r.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              type="button"
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(r.id)}
              className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${index === highlight ? "bg-muted" : ""}`}
            >
              <span className="text-foreground">{r.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{r.group}</span>
            </button>
          ))}
          {hidden > 0 ? (
            <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              {hidden} more match{hidden === 1 ? "" : "es"} — refine your search
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}


const ICON_BTN =
  "icon3d relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground " +
  "transition-[transform,box-shadow,color,background-color] duration-200 " +
  "hover:text-foreground active:scale-[0.96] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-background";

/**
 * `view` is optional and only seeds the starting screen. Software Vala reaches
 * this module from two places that already name a view — the Control Panel
 * route /finance-manager?view=… and the manager section registry — so the prop
 * is honoured when it names a real view and ignored otherwise. Everything below
 * is the module exactly as the Finance source defines it.
 */
export function FinanceManager({ view: initialView }: { view?: string | undefined } = {}) {
  const [view, setView] = useState<FinanceView>(
    (initialView && initialView in VIEW_LABELS ? initialView : "overview_total_balance") as FinanceView,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { collapsed, toggleCollapsed } = useSidebarState();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);

  const groupId = useMemo(
    () => FINANCE_GROUPS.find((g) => g.items.some((i) => i.id === view))?.id ?? "overview",
    [view],
  );
  const Section = GROUP_COMPONENTS[groupId] ?? OverviewSections;
  const meta = VIEW_LABELS[view];

  const select = (next: FinanceView) => {
    setView(next);
    setMobileOpen(false);
    setMobileSearchOpen(false);
  };

  return (
    <div className="flex min-h-dvh">
      <aside
        aria-label="Finance sidebar"
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-[width] duration-200 lg:flex",
          collapsed ? "w-[72px]" : "w-[264px]",
        )}
      >
        <FinanceSidebar
          activeView={view}
          onSelect={select}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center gap-2 px-3 lg:px-5">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className={cn(ICON_BTN, "lg:hidden")} aria-label="Open finance menu">
                  <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0">
                <SheetTitle className="sr-only">Finance navigation</SheetTitle>
                <FinanceSidebar
                  activeView={view}
                  onSelect={select}
                  onCloseMobile={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{meta?.group}</p>
              <p className="truncate text-sm font-semibold tracking-tight text-foreground">{meta?.label}</p>
            </div>

            <div className="hidden md:block">
              <FinanceSearch id="finance-search-desktop" onSelect={select} />
            </div>

            <Sheet open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
              <SheetTrigger asChild>
                <button className={cn(ICON_BTN, "md:hidden")} aria-label="Search finance modules">
                  <Search className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="top" className="p-4">
                <SheetTitle className="mb-3 text-sm">Search finance modules</SheetTitle>
                <FinanceSearch id="finance-search-mobile" onSelect={select} autoFocus />
              </SheetContent>
            </Sheet>

            <button
              className={ICON_BTN}
              aria-label="Refresh finance data"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["finance"] })}
            >
              <RefreshCcw className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>

            <button
              className={ICON_BTN}
              aria-label="Open finance notifications"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
        </header>

        <main
          ref={mainRef}
          tabIndex={-1}
          aria-labelledby="finance-view-title"
          className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        >
          <h1 id="finance-view-title" className="sr-only">
            {meta?.label ?? "Finance"} — {meta?.group ?? "Finance Manager"}
          </h1>
          <Section view={view} />
        </main>

        <FinanceNotifications open={notificationsOpen} onOpenChange={setNotificationsOpen} />
      </div>
    </div>
  );
}

