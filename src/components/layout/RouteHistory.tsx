// Route-scoped navigation history — persistent timeline + back/forward arrows
// + floating history panel. Adapted from vala-identity-engine for TanStack Router.

import {
  createContext, useCallback, useContext, useEffect, useMemo,
  useRef, useState, type ReactNode,
} from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, History as HistoryIcon, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HistoryEntry {
  path: string;
  label: string;
  module: string;
  at: number;
}

interface RouteHistoryCtx {
  entries: HistoryEntry[];
  cursor: number;
  current: HistoryEntry | null;
  back: () => void;
  forward: () => void;
  jumpTo: (index: number) => void;
  canBack: boolean;
  canForward: boolean;
  hydrated: boolean;
  storageOk: boolean;
}

const Ctx = createContext<RouteHistoryCtx | null>(null);
const STORAGE_KEY = "ams:route-history:v1";
const MAX = 40;

// ── Path → label / module resolver ────────────────────────────────────────
const LABEL_MAP: Record<string, { label: string; module: string }> = {
  "/": { label: "Command Center", module: "Overview" },
  "/role-manager": { label: "Role Manager", module: "Identity" },
  "/passport": { label: "Passport", module: "Identity" },
  "/identity": { label: "Identity Engine", module: "Identity" },
  "/achievements": { label: "Achievements", module: "Recognition" },
  "/awards": { label: "Awards", module: "Recognition" },
  "/badges": { label: "Badges", module: "Recognition" },
  "/trophies": { label: "Trophies", module: "Recognition" },
  "/certificates": { label: "Certificates", module: "Recognition" },
  "/xp": { label: "XP", module: "Progression" },
  "/levels": { label: "Levels", module: "Progression" },
  "/ranks": { label: "Ranks", module: "Progression" },
  "/missions": { label: "Missions", module: "Engagement" },
  "/quests": { label: "Quests", module: "Engagement" },
  "/challenges": { label: "Challenges", module: "Engagement" },
  "/rewards": { label: "Rewards", module: "Rewards" },
  "/claims": { label: "Claims", module: "Rewards" },
  "/leaderboards": { label: "Leaderboards", module: "Insights" },
  "/analytics": { label: "Analytics", module: "Insights" },
  "/notifications": { label: "Notifications", module: "System" },
  "/audit": { label: "Audit Logs", module: "System" },
  "/hall-of-fame": { label: "Hall of Fame", module: "Recognition" },
  "/ai": { label: "AI Center", module: "System" },
  "/chat": { label: "Chat", module: "System" },
  "/settings": { label: "Settings", module: "System" },
  "/legacy": { label: "Legacy", module: "Recognition" },
  "/collections": { label: "Collections", module: "Recognition" },
  "/trophy-gallery": { label: "Trophy Gallery", module: "Recognition" },
  "/role-showcase": { label: "Role Rooms", module: "Identity" },
};

function resolve(path: string): { label: string; module: string } {
  if (LABEL_MAP[path]) return LABEL_MAP[path];
  // vaults
  if (path.endsWith("-vault")) {
    const name = path.replace(/^\//, "").replace(/-vault$/, "").replace(/-/g, " ");
    return { label: `${name.replace(/\b\w/g, (c) => c.toUpperCase())} Vault`, module: "Vaults" };
  }
  // progression
  if (path.endsWith("-progression")) {
    const name = path.replace(/^\//, "").replace(/-progression$/, "");
    return { label: `${name[0]?.toUpperCase()}${name.slice(1)} Progression`, module: "Progression" };
  }
  // fallback — derive from last segment
  const seg = path.split("/").filter(Boolean).pop() ?? path;
  const label = seg.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { label: label || path, module: "AMS" };
}

type LoadResult = { entries: HistoryEntry[]; cursor: number; storageOk: boolean };

function loadPersisted(): LoadResult {
  if (typeof window === "undefined") return { entries: [], cursor: -1, storageOk: true };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], cursor: -1, storageOk: true };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.entries)) return { entries: [], cursor: -1, storageOk: true };
    return {
      entries: parsed.entries.filter((e: HistoryEntry) => e && typeof e.path === "string"),
      cursor: typeof parsed.cursor === "number" ? parsed.cursor : parsed.entries.length - 1,
      storageOk: true,
    };
  } catch { return { entries: [], cursor: -1, storageOk: false }; }
}

export function RouteHistoryProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [cursor, setCursor] = useState<number>(-1);
  const [hydrated, setHydrated] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const suppressRef = useRef(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch and to gracefully
  // handle environments where storage is unavailable (privacy mode, quota, etc).
  useEffect(() => {
    const res = loadPersisted();
    setEntries(res.entries);
    setCursor(res.cursor);
    setStorageOk(res.storageOk);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!pathname) return;
    if (suppressRef.current) { suppressRef.current = false; return; }

    const cur = entries[cursor]?.path;
    if (cur === pathname) return;

    let hit = -1;
    for (let i = cursor - 1; i >= 0; i--) {
      if (entries[i].path === pathname) { hit = i; break; }
    }
    if (hit === -1) {
      for (let i = cursor + 1; i < entries.length; i++) {
        if (entries[i].path === pathname) { hit = i; break; }
      }
    }
    if (hit !== -1) { setCursor(hit); return; }

    const meta = resolve(pathname);
    const trimmed = entries.slice(0, cursor + 1);
    const appended = [...trimmed, { path: pathname, label: meta.label, module: meta.module, at: Date.now() }];
    const capped = appended.slice(-MAX);
    setEntries(capped);
    setCursor(capped.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries, cursor }));
      if (!storageOk) setStorageOk(true);
    } catch {
      if (storageOk) setStorageOk(false);
    }
  }, [entries, cursor, hydrated, storageOk]);

  const goto = useCallback((path: string) => {
    router.navigate({ to: path });
  }, [router]);

  const back = useCallback(() => {
    if (cursor <= 0) return;
    const target = entries[cursor - 1];
    if (target) { suppressRef.current = true; setCursor(cursor - 1); goto(target.path); }
  }, [cursor, entries, goto]);

  const forward = useCallback(() => {
    if (cursor >= entries.length - 1) return;
    const target = entries[cursor + 1];
    if (target) { suppressRef.current = true; setCursor(cursor + 1); goto(target.path); }
  }, [cursor, entries, goto]);

  const jumpTo = useCallback((index: number) => {
    const target = entries[index];
    if (target) { suppressRef.current = true; setCursor(index); goto(target.path); }
  }, [entries, goto]);

  const value = useMemo<RouteHistoryCtx>(() => ({
    entries, cursor,
    current: cursor >= 0 ? entries[cursor] ?? null : null,
    back, forward, jumpTo,
    canBack: cursor > 0,
    canForward: cursor < entries.length - 1,
    hydrated, storageOk,
  }), [entries, cursor, back, forward, jumpTo, hydrated, storageOk]);

  // Alt+Arrow keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); back(); }
      if (e.key === "ArrowRight") { e.preventDefault(); forward(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, forward]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRouteHistory() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRouteHistory must be used inside RouteHistoryProvider");
  return v;
}

// ── Back / Forward arrows ────────────────────────────────────────────────
export function RouteHistoryArrows({ className }: { className?: string }) {
  const { back, forward, canBack, canForward } = useRouteHistory();
  return (
    <div
      className={cn(
        "inline-flex overflow-hidden rounded-md border border-border bg-muted/30",
        className,
      )}
      role="group"
      aria-label="History navigation"
    >
      <button
        type="button"
        onClick={back}
        disabled={!canBack}
        aria-label="Go back"
        title="Back (Alt+←)"
        className="grid h-7 w-7 place-items-center text-trophy transition-colors hover:bg-trophy/10 disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>
      <div className="w-px bg-border" />
      <button
        type="button"
        onClick={forward}
        disabled={!canForward}
        aria-label="Go forward"
        title="Forward (Alt+→)"
        className="grid h-7 w-7 place-items-center text-trophy transition-colors hover:bg-trophy/10 disabled:cursor-not-allowed disabled:text-muted-foreground/40 disabled:hover:bg-transparent"
      >
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── Floating panel + toggle ──────────────────────────────────────────────
function fmtTime(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function RouteHistoryPanel() {
  const { entries, cursor, jumpTo, current, hydrated, storageOk } = useRouteHistory();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const selector =
      'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const node = panelRef.current;
      const items = Array.from(node?.querySelectorAll<HTMLElement>(selector) ?? []);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !node?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      openerRef.current?.focus?.();
    };
  }, [open]);

  const list = entries.slice().reverse();
  const isLoading = !hydrated;
  const isEmpty = hydrated && list.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          isLoading
            ? "Open workspace history · loading"
            : `Open workspace history · ${entries.length} step${entries.length === 1 ? "" : "s"}`
        }
        aria-busy={isLoading}
        title="Workspace history"
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full border border-trophy/40 bg-background/95 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-trophy shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur hover:bg-trophy/10"
      >
        <HistoryIcon className={cn("h-3.5 w-3.5", isLoading && "animate-pulse")} />
        History
        {isLoading ? (
          <span className="h-3 w-6 animate-pulse rounded-full bg-trophy/20" aria-hidden />
        ) : entries.length > 0 ? (
          <span className="rounded-full bg-gold-gradient px-1.5 text-[10px] font-bold text-background">
            {entries.length}
          </span>
        ) : null}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex justify-end bg-background/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        >
          <aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="route-history-title"
            aria-describedby="route-history-desc"
            onClick={(e) => e.stopPropagation()}
            className="flex h-full w-full max-w-sm flex-col border-l border-trophy/30 bg-background/98 shadow-[-30px_0_60px_-20px_rgba(0,0,0,0.8)]"
          >
            <header className="flex items-center justify-between border-b border-trophy/30 px-4 py-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Workspace</div>
                <h2 id="route-history-title" className="text-base font-semibold text-gradient-trophy">
                  History · {isLoading ? "Loading…" : current?.label ?? "—"}
                </h2>
                <p id="route-history-desc" className="sr-only">
                  Timeline of screens you visited in this workspace. Press Escape to close.
                </p>
              </div>
              <button
                ref={closeRef}
                title="Close history panel"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close history panel"
                className="grid h-8 w-8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trophy place-items-center rounded-md border border-border text-trophy hover:bg-trophy/10"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {!storageOk && (
              <div
                role="status"
                className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Storage unavailable — history is tracked for this session only and won't
                  persist after refresh.
                </span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4" aria-busy={isLoading}>
              {isLoading ? (
                <ol className="relative ml-2 space-y-2 border-l border-trophy/30 pl-4" aria-hidden>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full bg-trophy/20 ring-2 ring-background" />
                      <div className="w-full rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="h-3 w-32 animate-pulse rounded bg-muted-foreground/20" />
                          <span className="h-2.5 w-10 animate-pulse rounded bg-muted-foreground/15" />
                        </div>
                        <span className="mt-2 block h-2 w-20 animate-pulse rounded bg-trophy/15" />
                      </div>
                    </li>
                  ))}
                </ol>
              ) : isEmpty ? (
                <div className="grid place-items-center py-16 text-center text-xs text-muted-foreground">
                  <HistoryIcon className="mb-3 h-8 w-8 opacity-40" />
                  No changes recorded yet.
                  <br />Navigate between screens to build a timeline.
                </div>
              ) : (
                <ol className="relative ml-2 space-y-2 border-l border-trophy/30 pl-4">
                  {list.map((e, i) => {
                    const originalIndex = entries.length - 1 - i;
                    const isActive = originalIndex === cursor;
                    return (
                      <li key={`${e.at}-${originalIndex}`} className="relative">
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -left-[21px] top-2 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                            isActive ? "bg-gold-gradient shadow-[0_0_8px_oklch(0.86_0.09_88)]" : "bg-trophy/40",
                          )}
                        />
                        <button
                          type="button"
                          onClick={() => { jumpTo(originalIndex); setOpen(false); }}
                          className={cn(
                            "w-full rounded-lg border px-3 py-2 text-left transition-all",
                            isActive
                              ? "border-trophy bg-trophy/10"
                              : "border-border bg-muted/20 hover:bg-trophy/5",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("truncate text-sm font-semibold", isActive ? "text-trophy" : "text-foreground")}>
                              {e.label}
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                              {fmtTime(e.at)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-trophy/70">{e.module}</div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <footer className="border-t border-trophy/30 px-4 py-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {isLoading
                ? "Loading timeline…"
                : `Workspace timeline · ${entries.length} step${entries.length === 1 ? "" : "s"}`}
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
