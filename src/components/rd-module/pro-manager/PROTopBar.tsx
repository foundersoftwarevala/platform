import type { ReactNode } from "react";
import { Lock, Search, ShieldAlert, Timer } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/rd-module/ui/input";
import { proScreens, type PROScreen } from "./PROSidebar";

interface PROTopBarProps {
  activeScreen: PROScreen;
  search: string;
  onSearchChange: (value: string) => void;
  sessionLabel: string;
  stats: { users: number; tickets: number; escalations: number; decisions: number };
  mobileNav?: ReactNode;
}

export const PROTopBar = ({
  activeScreen,
  search,
  onSearchChange,
  sessionLabel,
  stats,
  mobileNav,
}: PROTopBarProps) => {
  const current = proScreens.find((item) => item.id === activeScreen);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-4 px-4 py-4 sm:px-6">
        {mobileNav}
        <div className="min-w-0 flex-1 sm:min-w-[180px]">
          <p className="text-xs uppercase tracking-wide text-brand">Pro Manager</p>
          <p className="truncate font-display text-lg font-semibold text-foreground">
            {current?.label}
          </p>
        </div>

        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search accounts, tickets, codes…"
            className="pl-9"
            aria-label="Search Pro Manager records"
          />
        </div>

        <div className="hidden items-center gap-4 text-xs text-muted-foreground xl:flex">
          <span>{stats.users} accounts</span>
          <span>{stats.tickets} tickets</span>
          <span>{stats.escalations} escalations</span>
          <span>{stats.decisions} decisions</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs text-warning">
            <Timer aria-hidden="true" className="h-3.5 w-3.5" /> {sessionLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground">
            <Lock aria-hidden="true" className="h-3.5 w-3.5" /> Read-controlled
          </span>
          <Link
            to="/rd-manager/lab"
            className="rounded-full border border-border bg-surface-2 px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            R&amp;D
          </Link>
        </div>
      </div>

      <div className="flex items-start gap-2 border-t border-border bg-surface-2/60 px-6 py-2 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
        <p>
          Governance role: the Pro Manager may review, recommend and escalate. Moving money,
          deleting users and changing billing are permanently disabled and every action is written
          to the immutable audit trail.
        </p>
      </div>
    </header>
  );
};
