import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  KeyRound,
  Loader2,
  MessagesSquare,
  ScrollText,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Card, EmptyHint, PageHeader, StatCard } from "@/components/marketplace-manager/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getChatManagerQueue,
  getChatAssignableHandlers,
  getChatManagerMonitor,
  getChatManagerParticipants,
  getChatManagerAccess,
  getChatOverview,
  getRoleMatrix,
  resolveHandoff,
  searchChatParticipantCandidates,
  setRolePermission,
  updateChatManagerParticipant,
  updateConversationControls,
  type ChatManagerMonitor,
  type ChatQueueFilters,
  type ChatQueueRow,
  type ChatQueueView,
} from "@/lib/chat/manager.functions";
import { AgentAccess, TranscriptDialog } from "./oversight";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useSupabaseSession } from "@/hooks/use-session";

function useOverview() {
  const fetchOverview = useServerFn(getChatOverview);
  return useQuery({ queryKey: ["chat-manager", "overview"], queryFn: () => fetchOverview() });
}

function useChatManagerPermissions() {
  const { userId } = useSupabaseSession();
  const fetchAccess = useServerFn(getChatManagerAccess);
  const access = useQuery({
    queryKey: ["chat-manager", "access", userId],
    queryFn: () => fetchAccess(),
    enabled: !!userId,
    retry: false,
  });
  const permissions = useMemo(() => new Set(access.data?.permissions ?? []), [access.data]);
  const can = useCallback((permission: string) => permissions.has(permission), [permissions]);
  return { userId, can };
}

function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <div className="flex items-start gap-3 p-1 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <p className="font-semibold text-foreground">Cannot load chat data</p>
          <p className="mt-1 text-muted-foreground">{message}</p>
        </div>
      </div>
    </Card>
  );
}

function fmt(value: string) {
  return new Date(value).toLocaleString();
}

/* ------------------------------- dashboard -------------------------------- */

export function ChatDashboard() {
  const query = useOverview();
  const k = query.data?.kpis;

  return (
    <div>
      <PageHeader
        eyebrow="Connect Hub"
        title="Chat Manager"
        description="Conversations, handoffs, AI assistance, and chat activity in one place."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Conversations"
          value={k ? String(k.conversations) : "—"}
          icon={<MessagesSquare className="h-4 w-4" />}
        />
        <StatCard
          label="Open"
          value={k ? String(k.open) : "—"}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Escalated"
          value={k ? String(k.escalated) : "—"}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label="Messages · 24h"
          value={k ? String(k.messages24h) : "—"}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="AI replies · 24h"
          value={k ? String(k.aiReplies24h) : "—"}
          icon={<Bot className="h-4 w-4" />}
        />
        <StatCard
          label="Pending handoffs"
          value={k ? String(k.pendingHandoffs) : "—"}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Latest conversations</h3>
          {(query.data?.conversations ?? []).slice(0, 8).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {c.participants} participants · {fmt(c.last_message_at)}
                </p>
              </div>
              <Badge variant={c.status === "escalated" ? "destructive" : "secondary"}>
                {c.status}
              </Badge>
            </div>
          ))}
          {(query.data?.conversations ?? []).length === 0 ? (
            <EmptyHint text="No conversations yet." />
          ) : null}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Recent chat audit events</h3>
          {(query.data?.audit ?? []).slice(0, 8).map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0"
            >
              <span className="font-mono text-xs">{a.action}</span>
              <span className="text-xs text-muted-foreground">{fmt(a.occurred_at)}</span>
            </div>
          ))}
          {(query.data?.audit ?? []).length === 0 ? (
            <EmptyHint text="No chat audit events recorded yet." />
          ) : null}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- conversations ------------------------------- */

export function LiveConversations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetchQueue = useServerFn(getChatManagerQueue);
  const update = useServerFn(updateConversationControls);
  const { userId, can } = useChatManagerPermissions();
  const fetchHandlers = useServerFn(getChatAssignableHandlers);
  const [view, setView] = useState<ChatQueueView>("all");
  const [search, setSearch] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("conversationId") ?? ""),
  );
  const [deepLinkId, setDeepLinkId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("conversationId"),
  );
  const [handler, setHandler] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [ai, setAi] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reviewing, setReviewing] = useState<{ id: string; subject: string } | null>(null);
  const handlers = useQuery({
    queryKey: ["chat-manager", "assignable-handlers"],
    queryFn: () => fetchHandlers(),
    enabled: can("chat.assign"),
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const filters = useMemo<ChatQueueFilters>(
    () => ({
      view,
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
      ...(status ? { status: status as NonNullable<ChatQueueFilters["status"]> } : {}),
      ...(priority ? { priority: priority as NonNullable<ChatQueueFilters["priority"]> } : {}),
      ...(handler ? { handler } : {}),
      ...(ai ? { ai: ai as NonNullable<ChatQueueFilters["ai"]> } : {}),
      ...(from ? { from: new Date(`${from}T00:00:00`).toISOString() } : {}),
      ...(to ? { to: new Date(`${to}T23:59:59.999`).toISOString() } : {}),
    }),
    [view, debouncedSearch, status, priority, handler, ai, from, to],
  );
  const queue = useInfiniteQuery({
    queryKey: ["chat-manager", "queue", filters],
    initialPageParam: null as { at: string; id: string } | null,
    queryFn: ({ pageParam }) => fetchQueue({ data: { filters, limit: 30, cursor: pageParam } }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const mutation = useMutation({
    mutationFn: (input: {
      conversationId: string;
      status?: "open" | "pending" | "escalated" | "closed" | "resolved";
      priority?: "low" | "normal" | "high" | "urgent";
      aiEnabled?: boolean;
      assignedAgentId?: string | null;
    }) => update({ data: input }),
    onSuccess: (result) => {
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation updated");
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "queue"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => queue.data?.pages.flatMap((page) => page.rows) ?? [], [queue.data]);

  useEffect(() => {
    if (!deepLinkId) return;
    const conversation = rows.find((row) => row.id === deepLinkId);
    if (!conversation) return;
    setReviewing({ id: conversation.id, subject: conversation.subject });
    const url = new URL(window.location.href);
    url.searchParams.delete("conversationId");
    window.history.replaceState(window.history.state, "", url);
    setDeepLinkId(null);
  }, [deepLinkId, rows]);

  const views: { id: ChatQueueView; label: string }[] = [
    { id: "all", label: "All" },
    { id: "active", label: "Active" },
    { id: "waiting", label: "Waiting" },
    { id: "unassigned", label: "Unassigned" },
    { id: "ai", label: "AI" },
    { id: "human", label: "Human" },
    { id: "pending", label: "Pending" },
    { id: "escalated", label: "Escalated" },
    { id: "high", label: "High priority" },
    { id: "closed", label: "Closed" },
    { id: "reopened", label: "Reopened" },
    { id: "failed", label: "AI failed" },
    { id: "translation_pending", label: "Translation pending" },
    { id: "translation_failed", label: "Translation failed" },
  ];

  return (
    <div>
      <TranscriptDialog
        conversationId={reviewing?.id ?? null}
        subject={reviewing?.subject ?? ""}
        canModerate={can("chat.moderate")}
        canReply={can("message.send")}
        canHandle={can("chat.assign") || can("chat.manage")}
        canManage={can("chat.manage")}
        canAssign={can("chat.assign")}
        isUpdating={mutation.isPending}
        rows={rows}
        handlers={handlers.data ?? []}
        onSelect={(row) => setReviewing({ id: row.id, subject: row.subject })}
        onUpdate={(input) => mutation.mutate(input)}
        onClose={() => setReviewing(null)}
      />
      <PageHeader
        eyebrow="Operations"
        title="Live Conversations"
        description="Search and route canonical conversations. Filters and cursor pagination run on the server."
      />
      {queue.error ? <ErrorState message={queue.error.message} /> : null}
      <Card>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Conversation views">
            {views.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={view === item.id ? "default" : "outline"}
                role="tab"
                aria-selected={view === item.id}
                onClick={() => setView(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, conversation, message…"
                aria-label="Search conversations"
                className="pl-9"
              />
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filter by status"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Any status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="escalated">Escalated</option>
              <option value="closed">Closed</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              aria-label="Filter by priority"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Any priority</option>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={ai}
              onChange={(event) => setAi(event.target.value)}
              aria-label="Filter by AI handling"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">AI and human</option>
              <option value="on">AI enabled</option>
              <option value="off">AI disabled</option>
            </select>
            {can("chat.assign") ? (
              <select
                value={handler}
                onChange={(event) => setHandler(event.target.value)}
                aria-label="Filter by assigned handler"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Any handler</option>
                {(handlers.data ?? []).map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="Activity from date"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              aria-label="Activity through date"
            />
          </div>
          {handlers.error ? <ErrorState message={handlers.error.message} /> : null}
          {queue.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading conversations…
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((c) => (
                <article key={c.id} className="rounded-lg border border-border/70 p-3 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setReviewing({ id: c.id, subject: c.subject })}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{c.subject}</span>
                        <Badge variant={c.status === "escalated" ? "destructive" : "secondary"}>
                          {c.status}
                        </Badge>
                        {c.pending_handoff ? <Badge variant="destructive">Handoff</Badge> : null}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {c.customer_name ?? c.customer_id} · {c.department ?? c.kind} ·{" "}
                        {c.participants} participants · {fmt(c.last_message_at)}
                      </span>
                      {c.last_body ? (
                        <span className="mt-2 block break-words text-sm text-muted-foreground">
                          {c.last_kind === "ai" ? "AI · " : ""}
                          {c.last_body}
                        </span>
                      ) : null}
                    </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={c.priority}
                        onChange={(event) =>
                          mutation.mutate({
                            conversationId: c.id,
                            priority: event.target.value as "low" | "normal" | "high" | "urgent",
                          })
                        }
                        aria-label={`Priority for ${c.subject}`}
                        className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                        disabled={mutation.isPending}
                      >
                        <option value="low">Low</option>
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                      <Switch
                        checked={c.ai_enabled}
                        disabled={mutation.isPending}
                        onCheckedChange={(value) =>
                          mutation.mutate({ conversationId: c.id, aiEnabled: value })
                        }
                        aria-label={`AI ${c.ai_enabled ? "enabled" : "disabled"} for ${c.subject}`}
                      />
                      {can("chat.assign") && userId ? (
                        <select
                          value={c.assigned_agent_id ?? ""}
                          onChange={(event) =>
                            mutation.mutate({
                              conversationId: c.id,
                              assignedAgentId: event.target.value || null,
                            })
                          }
                          aria-label={`Assign ${c.subject}`}
                          className="h-9 max-w-48 rounded-md border border-input bg-background px-2 text-xs"
                          disabled={mutation.isPending || handlers.isLoading}
                        >
                          <option value="">Unassigned</option>
                          {(handlers.data ?? []).map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.id === userId ? "Me" : candidate.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({
                            conversationId: c.id,
                            status:
                              c.status === "closed" || c.status === "resolved" ? "open" : "closed",
                          })
                        }
                      >
                        {c.status === "closed" || c.status === "resolved" ? "Reopen" : "Close"}
                      </Button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {c.handler_name ? `Handler: ${c.handler_name}` : "Unassigned"}
                    {c.agent_key ? ` · AI agent: ${c.agent_key}` : ""}
                    {c.translation_failed ? " · Translation failed" : ""}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-1 px-0"
                    onClick={() => setReviewing({ id: c.id, subject: c.subject })}
                  >
                    {t("chat.manager.review")}
                  </Button>
                </article>
              ))}
              {!queue.isLoading && !queue.error && rows.length === 0 ? (
                <EmptyHint
                  text={debouncedSearch ? "No matching conversations." : "No conversations yet."}
                />
              ) : null}
              {queue.hasNextPage ? (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="outline"
                    disabled={queue.isFetchingNextPage}
                    onClick={() => void queue.fetchNextPage()}
                  >
                    {queue.isFetchingNextPage ? "Loading…" : "Load more"}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ handoff queue ----------------------------- */

export function HandoffQueue() {
  const query = useOverview();
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolveHandoff);
  const { userId, can } = useChatManagerPermissions();
  const mutation = useMutation({
    mutationFn: (input: { handoffId: string; status: "accepted" | "resolved" | "rejected" }) =>
      resolve({ data: input }),
    onSuccess: (result) => {
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Handoff updated");
      void queryClient.invalidateQueries({ queryKey: ["chat-manager"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data?.handoffs ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Human in the loop"
        title="Handoff Queue"
        description="Conversations the AI escalated or a person asked to route to a human agent."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <div className="grid gap-3">
        {rows.map((h) => (
          <Card key={h.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{h.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {h.requester} · {fmt(h.created_at)} · {h.reason ?? "No reason given"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={h.status === "pending" ? "destructive" : "secondary"}>
                  {h.status}
                </Badge>
                {h.status === "pending" ? (
                  can("chat.assign") ? (
                    <>
                      <Button
                        disabled={mutation.isPending}
                        size="sm"
                        onClick={() => mutation.mutate({ handoffId: h.id, status: "accepted" })}
                      >
                        Accept
                      </Button>
                      <Button
                        disabled={mutation.isPending}
                        size="sm"
                        variant="outline"
                        onClick={() => mutation.mutate({ handoffId: h.id, status: "rejected" })}
                      >
                        Reject
                      </Button>
                      <Button
                        disabled={mutation.isPending}
                        size="sm"
                        variant="outline"
                        onClick={() => mutation.mutate({ handoffId: h.id, status: "resolved" })}
                      >
                        Resolve
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Assignment permission required
                    </span>
                  )
                ) : null}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {rows.length === 0 ? <EmptyHint text="No handoff requests." /> : null}
    </div>
  );
}

/* ----------------------------- AI governance ------------------------------ */

export function AiGovernance() {
  const query = useOverview();
  const k = query.data?.kpis;
  const aiOn = useMemo(
    () => (query.data?.conversations ?? []).filter((c) => c.ai_enabled).length,
    [query.data],
  );

  return (
    <div>
      <PageHeader
        eyebrow="AI Gateway"
        title="AI Governance"
        description="Vala AI answers on any conversation with assistance enabled, and escalates to a human when it cannot decide."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="AI-enabled conversations"
          value={String(aiOn)}
          icon={<Bot className="h-4 w-4" />}
        />
        <StatCard
          label="AI replies · 24h"
          value={k ? String(k.aiReplies24h) : "—"}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="Escalated to humans"
          value={k ? String(k.escalated) : "—"}
          icon={<Users className="h-4 w-4" />}
        />
      </div>
      <Card>
        <h3 className="mb-2 text-sm font-semibold">Model routing</h3>
        <p className="text-sm text-muted-foreground">
          Replies are generated server-side through the AI API Manager, by the AI CEO specialist
          that fits the conversation. Rate limits, credit exhaustion and policy blocks are surfaced
          to the participant and written to the chat audit trail — never hidden behind a generic
          assistant answer.
        </p>
      </Card>
      <AgentAccess />
    </div>
  );
}

/* --------------------------- role access matrix --------------------------- */

export function RoleAccessMatrix() {
  const fetchMatrix = useServerFn(getRoleMatrix);
  const setPermission = useServerFn(setRolePermission);
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["chat-manager", "matrix"], queryFn: () => fetchMatrix() });
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (role: string, permission: string, enabled: boolean) => {
    setBusy(`${role}:${permission}`);
    try {
      const result = await setPermission({ data: { role, permission, enabled } });
      if (result && "error" in result && result.error) toast.error(result.error);
      else await queryClient.invalidateQueries({ queryKey: ["chat-manager", "matrix"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Role Access Matrix"
        description="Exactly what each role may do in chat. Changes take effect immediately and are audited."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <Card>
        {!query.data?.canManagePermissions ? (
          <p className="mb-4 text-sm text-muted-foreground">
            Read-only: an administrator with chat permission-management access is required to change
            these grants.
          </p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Role</th>
                {(query.data?.permissions ?? []).map((p) => (
                  <th key={p} className="py-2 pr-4 font-mono text-[11px] normal-case">
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(query.data?.roles ?? []).map((role) => (
                <tr key={role} className="border-t border-border/60">
                  <td className="py-2 pr-4 font-medium text-foreground">{role}</td>
                  {(query.data?.permissions ?? []).map((permission) => {
                    const on = (query.data?.granted[role] ?? []).includes(permission);
                    return (
                      <td key={permission} className="py-2 pr-4">
                        <Switch
                          checked={on}
                          disabled={
                            !query.data?.canManagePermissions || busy === `${role}:${permission}`
                          }
                          onCheckedChange={(value) => void toggle(role, permission, value)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(query.data?.roles ?? []).length === 0 ? (
          <EmptyHint text="No role permissions configured." />
        ) : null}
      </Card>
    </div>
  );
}

/* ------------------------------- audit trail ------------------------------ */

export function AuditTrail() {
  const query = useOverview();
  const rows = query.data?.audit ?? [];
  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Audit Trail"
        description="Immutable record of chat governance events — AI replies, escalations, permission changes and failures."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <Card>
        {rows.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 text-sm last:border-0"
          >
            <span className="font-mono text-xs">{a.action}</span>
            <Badge variant={a.severity === "high" ? "destructive" : "secondary"}>
              {a.severity}
            </Badge>
            <span className="text-xs text-muted-foreground">{fmt(a.occurred_at)}</span>
          </div>
        ))}
        {rows.length === 0 ? <EmptyHint text="No audit events yet." /> : null}
      </Card>
    </div>
  );
}

export function SecurityPolicy() {
  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Security Policy"
        description="The rules enforced by the database itself, not by the interface."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" /> Message immutability
          </h3>
          <p className="text-sm text-muted-foreground">
            Sent messages can never be edited or deleted — a database trigger rejects every attempt,
            including by administrators. Chat Manager can hide or correct what a customer sees; each
            action keeps the original, names who did it and why, and is written to the audit trail.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Participant-only access
          </h3>
          <p className="text-sm text-muted-foreground">
            Conversations, messages, files, reactions and receipts are readable only by
            participants; chat managers additionally hold review access through role permissions.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4 text-primary" /> Audited governance
          </h3>
          <p className="text-sm text-muted-foreground">
            Every AI reply, escalation and permission change writes an audit record with the acting
            user.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Least privilege
          </h3>
          <p className="text-sm text-muted-foreground">
            Assignment, moderation and export are separate permissions, so support staff can work
            without gaining administrative control.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function Participants() {
  const query = useOverview();
  const queryClient = useQueryClient();
  const { userId, can } = useChatManagerPermissions();
  const fetchParticipants = useServerFn(getChatManagerParticipants);
  const searchCandidates = useServerFn(searchChatParticipantCandidates);
  const updateParticipant = useServerFn(updateChatManagerParticipant);
  const [conversationId, setConversationId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const rows = useMemo(() => query.data?.conversations ?? [], [query.data?.conversations]);
  useEffect(() => {
    if (!conversationId && rows[0]) setConversationId(rows[0].id);
  }, [conversationId, rows]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const participants = useQuery({
    queryKey: ["chat-manager", "participants", conversationId],
    queryFn: () => fetchParticipants({ data: { conversationId } }),
    enabled: !!conversationId,
  });
  const candidates = useQuery({
    queryKey: ["chat-manager", "participant-candidates", debouncedSearch],
    queryFn: () => searchCandidates({ data: { query: debouncedSearch } }),
    enabled: can("chat.assign") && debouncedSearch.length >= 2,
  });
  const mutation = useMutation({
    mutationFn: (input: { userId: string; action: "add" | "remove" }) =>
      updateParticipant({ data: { conversationId, ...input } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation participants updated");
      setSearch("");
      void queryClient.invalidateQueries({
        queryKey: ["chat-manager", "participants", conversationId],
      });
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "queue"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const currentIds = new Set(
    (participants.data?.participants ?? []).map((person) => person.user_id),
  );

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Participants"
        description="Review and manage real conversation membership. Add or remove participants with chat assignment permission."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <Card>
        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Conversation</span>
          <select
            value={conversationId}
            onChange={(event) => setConversationId(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={rows.length === 0}
          >
            {rows.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.subject} · {conversation.participants} participants
              </option>
            ))}
          </select>
        </label>
        {participants.error ? <ErrorState message={participants.error.message} /> : null}
        {participants.isLoading ? (
          <p className="py-4 text-sm text-muted-foreground">Loading participants…</p>
        ) : (
          <div className="divide-y divide-border/60">
            {(participants.data?.participants ?? []).map((person) => (
              <div
                key={person.user_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{person.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.handle ? `@${person.handle} · ` : ""}
                    {person.role_label ?? "Participant"} · {person.presence}
                  </p>
                </div>
                {can("chat.assign") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ userId: person.user_id, action: "remove" })}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            ))}
            {!participants.isLoading && participants.data?.participants.length === 0 ? (
              <EmptyHint text="No participants are recorded for this conversation." />
            ) : null}
          </div>
        )}
        {can("chat.assign") && conversationId ? (
          <div className="mt-5 border-t border-border/60 pt-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Add a participant
              </span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search names (at least 2 characters)"
                aria-label="Search participants to add"
              />
            </label>
            {candidates.error ? <ErrorState message={candidates.error.message} /> : null}
            {candidates.isFetching ? (
              <p className="py-3 text-xs text-muted-foreground">Searching profiles…</p>
            ) : null}
            <div className="mt-2 divide-y divide-border/60">
              {(candidates.data ?? [])
                .filter((candidate) => !currentIds.has(candidate.id))
                .map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      {candidate.display_name}
                      {candidate.handle ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          @{candidate.handle}
                        </span>
                      ) : null}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ userId: candidate.id, action: "add" })}
                    >
                      Add
                    </Button>
                  </div>
                ))}
            </div>
            {debouncedSearch.length >= 2 &&
            !candidates.isFetching &&
            !candidates.error &&
            (candidates.data ?? []).filter((candidate) => !currentIds.has(candidate.id)).length ===
              0 ? (
              <EmptyHint text="No matching profiles available to add." />
            ) : null}
          </div>
        ) : null}
        {rows.length === 0 ? <EmptyHint text="No conversations yet." /> : null}
      </Card>
    </div>
  );
}

export function ActivityFeed() {
  const fetchMonitor = useServerFn(getChatManagerMonitor);
  const [hours, setHours] = useState(24);
  const monitorQuery = useQuery({
    queryKey: ["chat-manager", "monitor", hours],
    queryFn: () => fetchMonitor({ data: { hours } }),
    refetchInterval: 30_000,
  });
  const monitor: ChatManagerMonitor | undefined = monitorQuery.data;
  const n = (value: number | undefined) => (value === undefined ? "—" : value.toLocaleString());
  const seconds = (value: number | null | undefined) =>
    value === undefined || value === null ? "—" : `${Math.round(value)}s`;
  const milliseconds = (value: number | null | undefined) =>
    value === undefined || value === null ? "—" : `${Math.round(value).toLocaleString()}ms`;
  const translationStates = monitor?.chat_translation?.by_status;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Activity"
        description="Live telemetry from the canonical Chat, AI agent, worker, and translation systems."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {monitor ? `Updated ${fmt(monitor.generated_at)} · ${monitor.window_hours}h window` : ""}
        </p>
        <select
          value={hours}
          onChange={(event) => setHours(Number(event.target.value))}
          aria-label="Activity time window"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value={1}>Last hour</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
      </div>
      {monitorQuery.error ? <ErrorState message={monitorQuery.error.message} /> : null}
      {monitorQuery.isLoading ? (
        <p className="py-5 text-sm text-muted-foreground">Loading operational telemetry…</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Waiting for reply"
          value={n(monitor?.waiting?.waiting)}
          icon={<MessagesSquare className="h-4 w-4" />}
        />
        <StatCard
          label="First response · p50"
          value={seconds(monitor?.first_response?.p50_s)}
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="AI failures"
          value={n(monitor?.ai?.failed)}
          icon={<Bot className="h-4 w-4" />}
        />
        <StatCard
          label="Translation failures"
          value={n(monitor?.chat_translation?.failed)}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>
      {monitor ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Conversation health</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Open", n(monitor.conversations?.open)],
                ["Pending", n(monitor.conversations?.pending)],
                ["Escalated", n(monitor.conversations?.escalated)],
                ["Unassigned", n(monitor.conversations?.unassigned)],
                ["High priority", n(monitor.conversations?.high_priority)],
                ["Unanswered", n(monitor.first_response?.unanswered)],
                ["First response · p95", seconds(monitor.first_response?.p95_s)],
                ["AI response · p95", milliseconds(monitor.ai?.p95_ms)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Chat translations</h3>
            {translationStates ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(translationStates).map(([status, count]) => (
                  <div key={status} className="rounded-md bg-muted/40 p-3">
                    <p className="text-xs capitalize text-muted-foreground">{status}</p>
                    <p className="mt-1 font-semibold">{n(count)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyHint text="Chat translation telemetry is not available." />
            )}
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">Queue workers</h3>
            {monitor.queue_workers ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3">Job type</th>
                      <th className="pb-2 pr-3">Queued</th>
                      <th className="pb-2 pr-3">Running</th>
                      <th className="pb-2 pr-3">Failed</th>
                      <th className="pb-2">Dead letter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitor.queue_workers.map((worker) => (
                      <tr key={worker.job_type} className="border-t border-border/60">
                        <td className="py-2 pr-3 font-mono">{worker.job_type}</td>
                        <td className="py-2 pr-3">{n(worker.queued)}</td>
                        <td className="py-2 pr-3">{n(worker.running)}</td>
                        <td className="py-2 pr-3">{n(worker.failed_window)}</td>
                        <td className="py-2">{n(worker.dead_letter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {monitor.queue_workers.length === 0 ? (
                  <EmptyHint text="No worker job types are reported." />
                ) : null}
              </div>
            ) : (
              <EmptyHint text="Worker telemetry is not available." />
            )}
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">AI agents and runs</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {Object.entries(monitor.agent_runs?.by_state ?? {})
                .map(([state, count]) => `${state}: ${n(count)}`)
                .join(" · ") || "No agent-run state telemetry available."}
            </p>
            <p className="text-sm">
              AI replies {n(monitor.ai?.replied)} · escalations {n(monitor.ai?.escalated)}
            </p>
            {monitor.ai?.agents?.length ? (
              <div className="mt-3 space-y-2 border-t border-border/60 pt-2">
                {monitor.ai.agents.map((agent) => (
                  <div
                    key={agent.agent_key}
                    className="flex flex-wrap justify-between gap-2 text-xs"
                  >
                    <span className="font-mono">{agent.agent_key}</span>
                    <span className="text-muted-foreground">
                      {n(agent.events)} events · {n(agent.failed)} failed ·{" "}
                      {agent.avg_ms === null ? "—" : `${n(agent.avg_ms)}ms avg`}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
          <Card>
            <h3 className="mb-3 text-sm font-semibold">API provider activity</h3>
            {monitor.providers ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-3">Provider</th>
                      <th className="pb-2 pr-3">Calls</th>
                      <th className="pb-2 pr-3">Failed</th>
                      <th className="pb-2">Avg latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitor.providers.map((provider) => (
                      <tr key={provider.service} className="border-t border-border/60">
                        <td className="py-2 pr-3">{provider.service}</td>
                        <td className="py-2 pr-3">{n(provider.calls)}</td>
                        <td className="py-2 pr-3">{n(provider.failed)}</td>
                        <td className="py-2">
                          {provider.avg_ms === null ? "—" : `${n(provider.avg_ms)}ms`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {monitor.providers.length === 0 ? (
                  <EmptyHint text="No provider calls were recorded in this window." />
                ) : null}
              </div>
            ) : (
              <EmptyHint text="Provider telemetry is not available." />
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
