// Operational workspace bar — breadcrumb, related-screen chips, Pin, Share,
// and Next-in-module. Ported (deduped + restyled) from vala-identity-engine's
// Workspace shell. Renders below the TopBar for every authenticated route
// except the Command Center dashboard.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ChevronRight, Home, ArrowRight, Bookmark, BookmarkCheck, Share2, Check,
  Settings2, X, ArrowUp, ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Route → (module, label) registry ─────────────────────────────────────
type Meta = { label: string; module: string };

const REGISTRY: Record<string, Meta> = {
  "/role-manager":  { label: "Role Manager",  module: "Identity" },
  "/passport":      { label: "Passport",      module: "Identity" },
  "/identity":      { label: "Identity",      module: "Identity" },

  "/achievements":  { label: "Achievements",  module: "Recognition" },
  "/awards":        { label: "Awards",        module: "Recognition" },
  "/badges":        { label: "Badges",        module: "Recognition" },
  "/trophies":      { label: "Trophies",      module: "Recognition" },
  "/certificates":  { label: "Certificates",  module: "Recognition" },
  "/hall-of-fame":  { label: "Hall of Fame",  module: "Recognition" },
  "/legacy":        { label: "Legacy",        module: "Recognition" },
  "/collections":   { label: "Collections",   module: "Recognition" },
  "/trophy-gallery":{ label: "Trophy Gallery",module: "Recognition" },
  "/role-showcase": { label: "Role Rooms",    module: "Recognition" },

  "/xp":            { label: "XP",            module: "Progression" },
  "/levels":        { label: "Levels",        module: "Progression" },
  "/ranks":         { label: "Ranks",         module: "Progression" },
  "/developer-progression": { label: "Developer Progression", module: "Progression" },
  "/author-progression":    { label: "Author Progression",    module: "Progression" },
  "/vendor-progression":    { label: "Vendor Progression",    module: "Progression" },

  "/missions":      { label: "Missions",      module: "Engagement" },
  "/quests":        { label: "Quests",        module: "Engagement" },
  "/challenges":    { label: "Challenges",    module: "Engagement" },

  "/rewards":       { label: "Rewards",       module: "Rewards" },
  "/claims":        { label: "Claims",        module: "Rewards" },

  "/leaderboards":  { label: "Leaderboards",  module: "Insights" },
  "/analytics":     { label: "Analytics",     module: "Insights" },

  "/notifications": { label: "Notifications", module: "System" },
  "/audit":         { label: "Audit Logs",    module: "System" },
  "/ai":            { label: "AI Center",     module: "System" },
  "/chat":          { label: "Chat",          module: "System" },
  "/settings":      { label: "Settings",      module: "System" },

  "/passport-vault":       { label: "Passport Vault",       module: "Vaults" },
  "/achievement-vault":    { label: "Achievement Vault",    module: "Vaults" },
  "/award-vault":          { label: "Award Vault",          module: "Vaults" },
  "/membership-vault":     { label: "Membership Vault",     module: "Vaults" },
  "/rank-vault":           { label: "Rank Vault",           module: "Vaults" },
  "/verification-vault":   { label: "Verification Vault",   module: "Vaults" },
  "/reputation-vault":     { label: "Reputation Vault",     module: "Vaults" },
  "/trust-seal-vault":     { label: "Trust Seal Vault",     module: "Vaults" },
  "/recognition-coin-vault":{ label: "Recognition Coin Vault", module: "Vaults" },
  "/xp-crystal-vault":     { label: "XP Crystal Vault",     module: "Vaults" },
  "/reward-chest-vault":   { label: "Reward Chest Vault",   module: "Vaults" },
  "/honor-coin-vault":     { label: "Honor Coin Vault",     module: "Vaults" },
  "/legacy-medal-vault":   { label: "Legacy Medal Vault",   module: "Vaults" },
  "/identity-card-vault":  { label: "Identity Card Vault",  module: "Vaults" },
  "/license-card-vault":   { label: "License Card Vault",   module: "Vaults" },
  "/founder-seal-vault":   { label: "Founder Seal Vault",   module: "Vaults" },
  "/hall-of-fame-vault":   { label: "Hall of Fame Vault",   module: "Vaults" },
};

// Pre-compute module → ordered paths
const MODULE_ORDER: Record<string, string[]> = Object.entries(REGISTRY).reduce(
  (acc, [path, meta]) => {
    (acc[meta.module] ||= []).push(path);
    return acc;
  },
  {} as Record<string, string[]>,
);

// First route per module — the "module landing" the breadcrumb links to.
const MODULE_LANDING: Record<string, string> = Object.entries(MODULE_ORDER).reduce(
  (acc, [module, paths]) => {
    acc[module] = paths[0];
    return acc;
  },
  {} as Record<string, string>,
);

const PIN_KEY = "ams:workspace:pins:v1";

function readPins(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}

function writePins(pins: string[]) {
  try { window.localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch { /* ignore */ }
}

export function WorkspaceBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [pins, setPins] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [managing, setManaging] = useState(false);

  useEffect(() => { setPins(readPins()); }, []);

  const meta = REGISTRY[pathname];
  const siblings = meta ? MODULE_ORDER[meta.module] ?? [] : [];
  const currentIdx = meta ? siblings.indexOf(pathname) : -1;
  const nextPath = currentIdx >= 0 && currentIdx < siblings.length - 1
    ? siblings[currentIdx + 1] : null;
  const nextMeta = nextPath ? REGISTRY[nextPath] : null;
  const moduleLanding = meta ? MODULE_LANDING[meta.module] : null;
  const onModuleLanding = !!moduleLanding && pathname === moduleLanding;

  const pinned = pins.includes(pathname);

  const togglePin = useCallback(() => {
    setPins((prev) => {
      const next = prev.includes(pathname)
        ? prev.filter((p) => p !== pathname)
        : [...prev, pathname];
      writePins(next);
      return next;
    });
  }, [pathname]);

  const removePin = useCallback((path: string) => {
    setPins((prev) => {
      const next = prev.filter((p) => p !== path);
      writePins(next);
      return next;
    });
  }, []);

  const movePin = useCallback((path: string, dir: -1 | 1) => {
    setPins((prev) => {
      const idx = prev.indexOf(path);
      const target = idx + dir;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      writePins(next);
      return next;
    });
  }, []);

  const share = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* ignore */ }
  }, []);

  const goNext = useCallback(() => {
    if (nextPath) navigate({ to: nextPath });
  }, [navigate, nextPath]);

  // Keyboard shortcuts: Alt+P pin, Alt+S share, Alt+N next.
  // Skip when typing in inputs / textareas / contenteditable.
  useEffect(() => {
    if (!meta) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
      }
      const k = e.key.toLowerCase();
      if (k === "p") { e.preventDefault(); togglePin(); }
      else if (k === "s") { e.preventDefault(); void share(); }
      else if (k === "n") { if (nextPath) { e.preventDefault(); goNext(); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [meta, togglePin, share, goNext, nextPath]);

  const pinnedMetas = useMemo(
    () => pins.map((p) => ({ path: p, meta: REGISTRY[p] })).filter((x) => x.meta),
    [pins],
  );

  // Hide on dashboard / unknown routes to avoid clutter
  if (!meta || pathname === "/") return null;

  return (
    <div className="sticky top-14 z-20 -mx-4 border-y border-border/60 bg-background/85 px-4 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
        {/* breadcrumb — every crumb is a real Link */}
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-[11px] uppercase tracking-[0.18em]"
        >
          <Link
            to="/ams/overview"
            activeOptions={{ exact: true }}
            className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-trophy data-[status=active]:text-trophy"
          >
            <Home className="h-3 w-3" /> AMS
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          {moduleLanding ? (
            <Link
              to={moduleLanding}
              aria-current={onModuleLanding ? "page" : undefined}
              className={cn(
                "transition-colors hover:text-trophy",
                onModuleLanding ? "font-semibold text-trophy" : "text-muted-foreground",
              )}
            >
              {meta.module}
            </Link>
          ) : (
            <span className="text-muted-foreground">{meta.module}</span>
          )}
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span aria-current="page" className="truncate font-semibold text-trophy">
            {meta.label}
          </span>
        </nav>

        {/* operational actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePin}
            title={pinned ? "Unpin workspace (Alt+P)" : "Pin workspace (Alt+P)"}
            aria-keyshortcuts="Alt+P"
            aria-pressed={pinned}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] transition-colors",
              pinned
                ? "border-trophy bg-trophy/10 text-trophy"
                : "border-border bg-muted/30 text-muted-foreground hover:text-trophy",
            )}
          >
            {pinned ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
            {pinned ? "Pinned" : "Pin"}
          </button>
          <button
            type="button"
            onClick={share}
            title="Copy link to this workspace (Alt+S)"
            aria-keyshortcuts="Alt+S"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:text-trophy"
          >
            {copied ? <Check className="h-3 w-3 text-trophy" /> : <Share2 className="h-3 w-3" />}
            {copied ? "Copied" : "Share"}
          </button>
          {nextPath && nextMeta && (
            <button
              type="button"
              onClick={goNext}
              title={`Next: ${nextMeta.label} (Alt+N)`}
              aria-keyshortcuts="Alt+N"
              className="inline-flex items-center gap-1.5 rounded-md bg-gold-gradient px-3 py-1 text-[11px] font-semibold text-background shadow-[0_6px_16px_-6px_oklch(0.78_0.14_82)]"
            >
              Next: {nextMeta.label} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* related-screens chip row */}
      {siblings.length > 1 && (
        <div className="mx-auto mt-2 flex max-w-[1600px] flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Related
          </span>
          {siblings.map((p) => {
            const m = REGISTRY[p];
            const active = p === pathname;
            return (
              <Link
                key={p}
                to={p}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] transition-colors",
                  active
                    ? "border-trophy bg-trophy/15 text-trophy"
                    : "border-border text-muted-foreground hover:text-trophy",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* pinned strip */}
      {pinnedMetas.length > 0 && (
        <div className="mx-auto mt-2 flex max-w-[1600px] flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.2em] text-trophy/70">
            Pinned
          </span>
          {pinnedMetas.map(({ path, meta: m }) => (
            <Link
              key={path}
              to={path}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] transition-colors",
                path === pathname
                  ? "border-trophy bg-trophy/15 text-trophy"
                  : "border-trophy/40 text-trophy/80 hover:bg-trophy/10",
              )}
            >
              <Bookmark className="mr-1 inline h-2.5 w-2.5" />
              {m.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            aria-expanded={managing}
            title="Manage pinned workspaces"
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-trophy/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-trophy/80 transition-colors hover:bg-trophy/10"
          >
            <Settings2 className="h-2.5 w-2.5" />
            {managing ? "Done" : "Manage"}
          </button>
        </div>
      )}

      {/* pin management panel */}
      {managing && pinnedMetas.length > 0 && (
        <div className="mx-auto mt-2 max-w-[1600px] rounded-lg border border-trophy/30 bg-muted/30 p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.2em] text-trophy/80">
              Manage Pinned
            </span>
            <span className="text-[10px] text-muted-foreground/70">
              {pinnedMetas.length} item{pinnedMetas.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {pinnedMetas.map(({ path, meta: m }, idx) => (
              <li
                key={path}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/60 px-2 py-1"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Bookmark className="h-3 w-3 shrink-0 text-trophy/80" />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-medium text-foreground">
                      {m.label}
                    </div>
                    <div className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                      {m.module}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => movePin(path, -1)}
                    disabled={idx === 0}
                    aria-label={`Move ${m.label} up`}
                    className="rounded border border-border p-1 text-muted-foreground transition-colors hover:text-trophy disabled:opacity-30"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePin(path, 1)}
                    disabled={idx === pinnedMetas.length - 1}
                    aria-label={`Move ${m.label} down`}
                    className="rounded border border-border p-1 text-muted-foreground transition-colors hover:text-trophy disabled:opacity-30"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePin(path)}
                    aria-label={`Remove ${m.label} from pins`}
                    className="rounded border border-border p-1 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-muted-foreground/60">
            Shortcuts: <kbd className="rounded bg-muted px-1">Alt+P</kbd> pin ·{" "}
            <kbd className="rounded bg-muted px-1">Alt+S</kbd> share ·{" "}
            <kbd className="rounded bg-muted px-1">Alt+N</kbd> next
          </p>
        </div>
      )}
    </div>
  );
}
