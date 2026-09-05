import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Command, HelpCircle, LogOut, Menu, Plus, Search, Settings, User, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-bridge";
import { toast } from "sonner";
import { CommandPalette, useCommandPalette } from "@/components/affiliate/CommandPalette";
import { NotificationCenter } from "@/components/affiliate/NotificationCenter";
import { RightActionPanel } from "@/components/affiliate/RightActionPanel";
import { useSession, userInitials } from "@/lib/use-session";
import { useQueryClient } from "@tanstack/react-query";

/** Shared premium 3D-style icon button surface. */
const ICON_BTN =
  "icon3d relative grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted-foreground " +
  "transition-[transform,box-shadow,color,background-color] duration-200 " +
  "hover:text-foreground active:scale-[0.96] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TopBar({ onOpenMenu }: { onOpenMenu?: () => void }) {
  const palette = useCommandPalette();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { user, loading: sessionLoading } = useSession();
  const queryClient = useQueryClient();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-1.5 px-3 lg:px-5">
        <button className={cn(ICON_BTN, "lg:hidden")} onClick={onOpenMenu} aria-label="Open menu">
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <Link to="/affiliate-manager" className="mr-1 flex shrink-0 items-center gap-2 lg:hidden" aria-label="Affiliate Manager home">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-[11px] font-bold text-primary-foreground">
            SV
          </span>
        </Link>

        <div className="hidden w-full max-w-md items-center gap-2 md:flex">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/affiliate-manager/search", search: { q, kind: [], group: [], wall: "" } });
            }}
            className="relative w-full"
            role="search"
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search affiliates, campaigns, orders…"
              className="focus-glow h-9 rounded-xl border-border bg-surface pl-8 pr-24"
              aria-label="Universal search"
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => palette.setOpen(true)}
                className="flex items-center gap-1 rounded-lg border border-border bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                aria-label="Open command palette"
                title="Command palette (⌘K)"
              >
                <Command className="size-3" /> K
              </button>
              <Button type="submit" size="sm" variant="secondary" className="h-6 rounded-lg px-2 text-[11px]">
                Search
              </Button>
            </div>
          </form>
        </div>

        <div className="flex-1" />

        <nav className="flex items-center gap-1.5" aria-label="Global actions">
          <button
            className={cn(ICON_BTN, "md:hidden")}
            aria-label="Search"
            onClick={() => palette.setOpen(true)}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <button
            className={ICON_BTN}
            aria-label="Open command palette (Command or Control + K)"
            title="Command palette (⌘K)"
            onClick={() => palette.setOpen(true)}
          >
            <Command className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            className={cn(ICON_BTN, "hidden sm:grid")}
            aria-label="Help & keyboard shortcuts"
            title="Help (⌘K)"
            onClick={() => palette.setOpen(true)}
          >
            <HelpCircle className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <NotificationCenter
            trigger={
              <button className={ICON_BTN} aria-label="Notifications — 1 or more unread alerts">
                <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 size-2.5 rounded-full bg-accent-pink ring-2 ring-background"
                />
                <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                  You have unread notifications
                </span>
              </button>
            }
          />
          <RightActionPanel
            trigger={
              <button
                className={cn(ICON_BTN, "icon3d--accent text-primary-foreground")}
                aria-label="Quick actions — create new record"
              >
                <Plus className="h-[18px] w-[18px]" />
              </button>
            }
          />
          {sessionLoading ? (
            <div className="ml-0.5 size-9 animate-pulse rounded-xl bg-muted" aria-hidden="true" />
          ) : !user ? (
            <Button asChild size="sm" variant="secondary" className="ml-1 h-9 rounded-xl">
              <Link to="/auth">Sign in</Link>
            </Button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Operator menu — signed in as ${user.email ?? "operator"}`}
                  className="relative ml-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-[11px] font-bold text-primary-foreground ring-1 ring-white/15 transition-transform duration-200 active:scale-[0.96]"
                >
                  {userInitials(user.email)}
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-accent-emerald ring-2 ring-background" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {user.email ?? "Boss Panel Operator"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/affiliate-manager/settings">
                    <User className="mr-2 size-4" /> Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/affiliate-manager/settings">
                    <Settings className="mr-2 size-4" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => palette.setOpen(true)}>
                  <Command className="mr-2 size-4" /> Command palette
                  <span className="ml-auto text-[10px] text-muted-foreground">⌘K</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    await queryClient.cancelQueries();
                    queryClient.clear();
                    try {
                      await signOut();
                      toast.success("Signed out");
                    } catch (error) {
                      console.error("Logout failed:", error);
                      toast.error("Failed to sign out");
                    } finally {
                      navigate({ to: "/auth", replace: true });
                    }
                  }}
                >
                  <LogOut className="mr-2 size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>
      </div>

      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
    </header>
  );
}
