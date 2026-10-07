import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  Command,
  Gauge,
  Headphones,
  KeyRound,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  ScrollText,
  Users,
  UserRoundCheck,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { subscribeNotificationStream } from "@/lib/realtime/notification-stream";
import { getChatManagerAccess, getChatOverview } from "@/lib/chat/manager.functions";
import { useSupabaseSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/marketplace-manager/ui";
import { Toaster } from "@/components/ui/sonner";

import {
  ActivityFeed,
  AiGovernance,
  AuditTrail,
  ChatDashboard,
  HandoffQueue,
  LiveConversations,
  Participants,
  RoleAccessMatrix,
  SecurityPolicy,
} from "./sections";

type Section = {
  label: string;
  description: string;
  icon: LucideIcon;
  component: ComponentType;
};

const sections: Section[] = [
  {
    label: "Dashboard",
    description: "Live chat operations overview",
    icon: Gauge,
    component: ChatDashboard,
  },
  {
    label: "Live Conversations",
    description: "Search, route and review conversations",
    icon: MessagesSquare,
    component: LiveConversations,
  },
  {
    label: "Handoff Queue",
    description: "Human requests and escalations",
    icon: UserRoundCheck,
    component: HandoffQueue,
  },
  {
    label: "Participants",
    description: "Conversation membership",
    icon: Users,
    component: Participants,
  },
  {
    label: "Activity",
    description: "Recent chat activity",
    icon: Activity,
    component: ActivityFeed,
  },
  {
    label: "AI Governance",
    description: "Agent access and AI events",
    icon: Bot,
    component: AiGovernance,
  },
  {
    label: "Role Access Matrix",
    description: "Chat permissions by role",
    icon: KeyRound,
    component: RoleAccessMatrix,
  },
  {
    label: "Security Policy",
    description: "Chat access and message policy",
    icon: ShieldCheck,
    component: SecurityPolicy,
  },
  {
    label: "Audit Trail",
    description: "Recorded governance actions",
    icon: ScrollText,
    component: AuditTrail,
  },
];

const groups = [
  { label: "Workspace", items: ["Dashboard", "Live Conversations", "Handoff Queue"] },
  { label: "Operations", items: ["Participants", "Activity", "AI Governance"] },
  { label: "Governance", items: ["Role Access Matrix", "Security Policy", "Audit Trail"] },
];

function LoadingAccess() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <div className="flex items-center gap-3 text-sm text-slate-300" role="status">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        Checking Chat Manager access…
      </div>
    </main>
  );
}

function DeniedAccess() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
      <Card className="max-w-md border-white/10 bg-slate-900 p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <h1 className="font-semibold">Chat Manager access required</h1>
            <p className="mt-2 text-sm text-slate-300">
              This account does not have the chat.manage permission. Ask a workspace administrator
              to grant access.
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-medium text-sky-300 hover:text-sky-200"
              to="/control-panel"
            >
              Return to Control Panel
            </Link>
          </div>
        </div>
      </Card>
    </main>
  );
}

function ChatManagerContent() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getChatOverview);
  const [realtimeState, setRealtimeState] = useState<"connecting" | "live" | "unavailable">(
    "connecting",
  );
  const overview = useQuery({
    queryKey: ["chat-manager", "overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 60_000,
  });
  const [activeLabel, setActiveLabel] = useState(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has("conversationId")
      ? "Live Conversations"
      : "Dashboard",
  );
  const [search, setSearch] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(
    () =>
      subscribeNotificationStream((event) => {
        if (event.type === "open") {
          setRealtimeState("live");
          void queryClient.invalidateQueries({ queryKey: ["chat-manager"] });
        } else if (event.type === "unavailable") {
          setRealtimeState("unavailable");
        } else if (event.event?.startsWith("chat.")) {
          void queryClient.invalidateQueries({ queryKey: ["chat-manager"] });
        }
      }),
    [queryClient],
  );

  useEffect(() => {
    if (!paletteOpen) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPaletteOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paletteOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const active = sections.find((section) => section.label === activeLabel) ?? sections[0]!;
  const ActiveSection = active.component;
  const filteredSections = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? sections.filter(
          (section) =>
            section.label.toLowerCase().includes(term) ||
            section.description.toLowerCase().includes(term),
        )
      : sections;
  }, [search]);
  const counts = overview.data?.kpis;
  const sidebarWidth = collapsed ? "lg:w-[76px]" : "lg:w-[292px]";

  const selectSection = (label: string) => {
    setActiveLabel(label);
    setPaletteOpen(false);
    setMobileOpen(false);
    setSearch("");
  };

  const sidebar = (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-slate-950 text-slate-100 transition-transform duration-200 ${sidebarWidth} ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:static lg:translate-x-0`}
    >
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/15 text-sm font-black text-sky-300 ring-1 ring-sky-300/20">
          SV
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Chat Manager</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">Software Vala · Connect Hub</p>
          </div>
        ) : null}
        <button
          type="button"
          className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collapsed ? (
        <div className="px-3 pt-4">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-10 w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-left text-sm text-slate-400 transition hover:border-white/20 hover:bg-white/[0.06]"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1">Find a section…</span>
            <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">
              Ctrl K
            </kbd>
          </button>
        </div>
      ) : null}

      <nav
        aria-label="Chat Manager sections"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5"
      >
        {groups.map((group) => {
          const groupSections = group.items
            .map((label) => sections.find((section) => section.label === label))
            .filter((section): section is Section => section !== undefined);
          const GroupIcon =
            group.label === "Workspace"
              ? LayoutDashboard
              : group.label === "Operations"
                ? Headphones
                : ShieldCheck;
          return (
            <div key={group.label}>
              {!collapsed ? (
                <p className="mb-2 flex items-center gap-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <GroupIcon className="h-3.5 w-3.5" />
                  {group.label}
                </p>
              ) : null}
              <div className="space-y-1">
                {groupSections.map((section) => {
                  const Icon = section.icon;
                  const selected = active.label === section.label;
                  return (
                    <button
                      key={section.label}
                      type="button"
                      title={collapsed ? section.label : undefined}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => selectSection(section.label)}
                      className={`group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition ${
                        selected
                          ? "bg-sky-400/15 font-medium text-sky-200 ring-1 ring-inset ring-sky-300/20"
                          : "text-slate-400 hover:bg-white/[0.055] hover:text-slate-100"
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${selected ? "text-sky-300" : ""}`} />
                      {!collapsed ? (
                        <span className="min-w-0 flex-1 truncate">{section.label}</span>
                      ) : null}
                      {!collapsed &&
                      section.label === "Handoff Queue" &&
                      counts?.pendingHandoffs ? (
                        <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200">
                          {counts.pendingHandoffs}
                        </span>
                      ) : null}
                      {!collapsed && selected ? (
                        <Check className="h-3.5 w-3.5 text-sky-300" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        {!collapsed ? (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.035] px-3 py-2.5">
            {overview.error ? (
              <>
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                  Data unavailable
                </span>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
              </>
            ) : (
              <>
                <span
                  className={`h-2 w-2 rounded-full ${
                    realtimeState === "live"
                      ? "bg-emerald-400"
                      : realtimeState === "unavailable"
                        ? "bg-amber-400"
                        : "animate-pulse bg-slate-400"
                  }`}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
                  {overview.isLoading
                    ? "Loading chat data…"
                    : realtimeState === "live"
                      ? "Realtime live"
                      : realtimeState === "unavailable"
                        ? "Realtime not available"
                        : "Realtime connecting"}
                </span>
                <span className="text-[10px] text-slate-500">
                  {counts ? `${counts.open} open` : ""}
                </span>
              </>
            )}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Link
            to="/control-panel"
            title="Return to Control Panel"
            className="flex min-h-10 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-sm text-slate-400 transition hover:bg-white/[0.055] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            {!collapsed ? <span className="truncate">Control Panel</span> : null}
          </Link>
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-2 text-slate-500 transition hover:bg-white/[0.055] hover:text-white lg:inline-flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Dismiss navigation"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      {sidebar}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 sm:flex">
            <span>Connect Hub</span>
            <ChevronDown className="h-3 w-3 -rotate-90" />
            <span className="truncate text-slate-300">{active.label}</span>
          </div>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="ml-auto flex h-10 w-full max-w-[360px] items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-left text-sm text-slate-400 transition hover:border-white/20 hover:bg-white/[0.06] sm:ml-0"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Search Chat Manager…</span>
            <Command className="hidden h-3.5 w-3.5 sm:block" />
            <kbd className="text-[10px] text-slate-500">K</kbd>
          </button>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            <div
              className="flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-[11px] font-medium text-emerald-200"
              aria-live="polite"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  overview.error ? "bg-rose-400" : "bg-emerald-400"
                }`}
              />
              {overview.error ? "Chat data unavailable" : "Chat access verified"}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-white/10 bg-white/[0.035] text-slate-200 hover:bg-white/[0.08]"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ["chat-manager"] })}
            >
              Refresh
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-6 md:py-7">
            <div className="min-w-0 rounded-xl border border-white/[0.08] bg-slate-900/50 p-3 shadow-2xl shadow-black/10 sm:p-5 md:p-6">
              <ActiveSection />
            </div>
            <footer className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-2">
                {overview.error ? (
                  <>
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-300" />
                    Chat data refresh failed
                  </>
                ) : realtimeState === "live" ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Live chat events refresh this workspace
                  </>
                ) : (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Realtime: NOT AVAILABLE
                  </>
                )}
              </span>
              <span>Software Vala · Internal operations</span>
            </footer>
          </div>
        </div>
      </div>

      {paletteOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 px-3 pt-[12vh] backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaletteOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-manager-search-title"
            className="w-full max-w-xl overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <label
                className="sr-only"
                id="chat-manager-search-title"
                htmlFor="chat-manager-section-search"
              >
                Search Chat Manager sections
              </label>
              <Input
                id="chat-manager-section-search"
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && filteredSections[0]) {
                    selectSection(filteredSections[0].label);
                  }
                }}
                placeholder="Search sections…"
                className="h-12 border-0 bg-transparent px-0 text-slate-100 shadow-none focus-visible:ring-0"
              />
              <kbd className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-500">
                ESC
              </kbd>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.label}
                    type="button"
                    onClick={() => selectSection(section.label)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition ${
                      section.label === active.label
                        ? "bg-sky-400/10 text-sky-100"
                        : "text-slate-200 hover:bg-white/[0.06]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-sky-300" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{section.label}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {section.description}
                      </span>
                    </span>
                    {section.label === active.label ? <Check className="h-4 w-4" /> : null}
                  </button>
                );
              })}
              {filteredSections.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400">
                  No matching Chat Manager sections.
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-[10px] text-slate-500">
              <span>Enter to open</span>
              <span>·</span>
              <span>Esc to close</span>
              <span className="ml-auto">{filteredSections.length} sections</span>
            </div>
          </section>
        </div>
      ) : null}
      <Toaster />
    </div>
  );
}

export function ChatManagerWorkspace() {
  const { userId, loading } = useSupabaseSession();
  const fetchAccess = useServerFn(getChatManagerAccess);
  const access = useQuery({
    queryKey: ["chat-manager", "access", userId],
    queryFn: () => fetchAccess(),
    enabled: !!userId,
    retry: false,
  });
  const redirecting = useRef(false);

  useEffect(() => {
    if (!loading && !userId && !redirecting.current) {
      redirecting.current = true;
      window.location.assign("/login?redirect=%2Fchat-manager");
    }
  }, [loading, userId]);

  if (loading || (userId && access.isLoading)) return <LoadingAccess />;
  if (!userId) return <LoadingAccess />;
  if (access.error) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-4 text-slate-100">
        <Card className="max-w-md border-white/10 bg-slate-900 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-rose-300" />
            <div>
              <h1 className="font-semibold">Could not verify Chat Manager access</h1>
              <p className="mt-2 text-sm text-slate-300">{access.error.message}</p>
            </div>
          </div>
        </Card>
      </main>
    );
  }
  if (!access.data?.canManageChat) return <DeniedAccess />;
  return <ChatManagerContent />;
}
