import { Link } from "@tanstack/react-router";
import { Bell, Search, Sparkles, Zap, ChevronDown, User2, Settings, Menu, Trophy } from "lucide-react";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { RouteHistoryArrows } from "@/components/layout/RouteHistory";
import { SoundControl } from "@/components/ams/ui/SoundControl";

const ICON_BTN =
  "icon3d relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground " +
  "transition-[transform,box-shadow,color,background-color] duration-200 " +
  "hover:text-foreground active:scale-[0.96] focus-visible:outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1.5 px-3 lg:px-5">
        <button className={cn(ICON_BTN, "lg:hidden")} onClick={onOpenMenu} aria-label="Open menu">
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <Link to="/ams/overview" className="flex shrink-0 items-center gap-2 lg:hidden" aria-label="AMS Manager home">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Trophy className="h-4 w-4" />
          </span>
        </Link>

        <RouteHistoryArrows className="hidden shrink-0 sm:flex" />

        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder="Search achievements, users, rewards…"
            aria-label="Search"
            className="focus-glow h-9 w-full rounded-xl border border-border bg-surface pl-9 pr-14 text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="absolute right-3 top-1/2 hidden h-5 -translate-y-1/2 select-none items-center gap-1 rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] text-muted-foreground sm:inline-flex">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Link to="/ams/notifications" className={cn(ICON_BTN, "hidden sm:grid")} aria-label="Notifications">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          </Link>
          <Link to="/ams/ai" className={cn(ICON_BTN, "hidden sm:grid")} aria-label="AI Center">
            <Sparkles className="h-[18px] w-[18px]" />
          </Link>
          <Link to="/ams/xp" className={cn(ICON_BTN, "hidden md:grid")} aria-label="XP">
            <Zap className="h-[18px] w-[18px]" />
          </Link>
          <SoundControl />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="icon3d flex h-9 items-center gap-2 rounded-xl px-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Account menu"
              >
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-[11px] font-semibold text-primary-foreground">
                  A
                </span>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Admin</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/ams/identity"><User2 className="mr-2 h-4 w-4" /> Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/ams/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
