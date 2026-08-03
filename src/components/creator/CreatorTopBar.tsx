import { Link } from "@tanstack/react-router";
import { Bell, Globe, LayoutDashboard, Menu, Search, Settings, User } from "lucide-react";

export function CreatorTopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        <button
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border lg:hidden"
          onClick={onOpenMenu}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link to="/" className="flex shrink-0 items-center gap-2 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow font-bold text-primary-foreground">
            SV
          </span>
        </Link>

        <div className="hidden w-56 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 transition-colors focus-within:border-primary/50 md:flex lg:w-72 2xl:w-96">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Search…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border px-1.5 text-[10px] text-muted-foreground 2xl:inline">
            ⌘K
          </kbd>
        </div>

        <div className="flex-1" />

        <span className="hidden items-center gap-1 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground lg:flex">
          <Globe className="h-3.5 w-3.5" /> EN
        </span>

        <Link
          to="/"
          className="hidden items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground lg:flex"
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Control Panel
        </Link>

        <button
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground"
          aria-label="Account"
        >
          <User className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
