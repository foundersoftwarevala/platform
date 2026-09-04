import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  KeyRound,
  MessagesSquare,
  ScrollText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Card, EmptyHint, PageHeader, StatCard } from "@/components/marketplace-manager/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  getChatOverview,
  getRoleMatrix,
  resolveHandoff,
  setRolePermission,
  updateConversationControls,
} from "@/lib/chat/manager.functions";

function useOverview() {
  const fetchOverview = useServerFn(getChatOverview);
  return useQuery({ queryKey: ["chat-manager", "overview"], queryFn: () => fetchOverview() });
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
        title="Chat Command Console"
        description="Live enterprise communication control — conversations, AI assistance, human handoff, permissions and audit."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Conversations" value={k ? String(k.conversations) : "—"} icon={<MessagesSquare className="h-4 w-4" />} />
        <StatCard label="Open" value={k ? String(k.open) : "—"} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label="Escalated" value={k ? String(k.escalated) : "—"} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label="Messages · 24h" value={k ? String(k.messages24h) : "—"} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="AI replies · 24h" value={k ? String(k.aiReplies24h) : "—"} icon={<Bot className="h-4 w-4" />} />
        <StatCard label="Pending handoffs" value={k ? String(k.pendingHandoffs) : "—"} icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Latest conversations</h3>
          {(query.data?.conversations ?? []).slice(0, 8).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{c.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {c.participants} participants · {fmt(c.last_message_at)}
                </p>
              </div>
              <Badge variant={c.status === "escalated" ? "destructive" : "secondary"}>{c.status}</Badge>
            </div>
          ))}
          {(query.data?.conversations ?? []).length === 0 ? <EmptyHint text="No conversations yet." /> : null}
        </Card>
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Recent chat audit events</h3>
          {(query.data?.audit ?? []).slice(0, 8).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
              <span className="font-mono text-xs">{a.action}</span>
              <span className="text-xs text-muted-foreground">{fmt(a.occurred_at)}</span>
            </div>
          ))}
          {(query.data?.audit ?? []).length === 0 ? <EmptyHint text="No chat audit events recorded yet." /> : null}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- conversations ------------------------------- */

export function LiveConversations() {
  const query = useOverview();
  const queryClient = useQueryClient();
  const update = useServerFn(updateConversationControls);
  const mutation = useMutation({
    mutationFn: (input: { conversationId: string; status?: string; priority?: string; aiEnabled?: boolean }) =>
      update({ data: input }),
    onSuccess: (result) => {
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation updated");
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = query.data?.conversations ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Live Conversations"
        description="Every conversation in the workspace with routing, priority, AI assistance and lifecycle controls."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Dept</th>
                <th className="py-2 pr-3">People</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">AI</th>
                <th className="py-2 pr-3">Last activity</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border/60">
                  <td className="py-2 pr-3 font-medium text-foreground">{c.subject}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{c.department ?? "—"}</td>
                  <td className="py-2 pr-3">{c.participants}</td>
                  <td className="py-2 pr-3">{c.priority}</td>
                  <td className="py-2 pr-3">
                    <Badge variant={c.status === "escalated" ? "destructive" : "secondary"}>{c.status}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    <Switch
                      checked={c.ai_enabled}
                      onCheckedChange={(value) =>
                        mutation.mutate({ conversationId: c.id, aiEnabled: value })
                      }
                    />
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{fmt(c.last_message_at)}</td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        mutation.mutate({
                          conversationId: c.id,
                          status: c.status === "closed" ? "open" : "closed",
                        })
                      }
                    >
                      {c.status === "closed" ? "Reopen" : "Close"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? <EmptyHint text="No conversations yet." /> : null}
      </Card>
    </div>
  );
}

/* ------------------------------ handoff queue ----------------------------- */

export function HandoffQueue() {
  const query = useOverview();
  const queryClient = useQueryClient();
  const resolve = useServerFn(resolveHandoff);
  const mutation = useMutation({
    mutationFn: (input: { handoffId: string; status: "accepted" | "resolved" | "rejected" }) =>
      resolve({ data: input }),
    onSuccess: (result) => {
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Handoff updated");
      void queryClient.invalidateQueries({ queryKey: ["chat-manager", "overview"] });
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
                <Badge variant={h.status === "pending" ? "destructive" : "secondary"}>{h.status}</Badge>
                {h.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => mutation.mutate({ handoffId: h.id, status: "accepted" })}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => mutation.mutate({ handoffId: h.id, status: "resolved" })}
                    >
                      Resolve
                    </Button>
                  </>
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
        <StatCard label="AI-enabled conversations" value={String(aiOn)} icon={<Bot className="h-4 w-4" />} />
        <StatCard label="AI replies · 24h" value={k ? String(k.aiReplies24h) : "—"} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Escalated to humans" value={k ? String(k.escalated) : "—"} icon={<Users className="h-4 w-4" />} />
      </div>
      <Card>
        <h3 className="mb-2 text-sm font-semibold">Model routing</h3>
        <p className="text-sm text-muted-foreground">
          Replies are generated server-side through the Lovable AI gateway. Rate limits, credit exhaustion and
          policy blocks are surfaced to the participant and written to the chat audit trail — never hidden behind a
          generic assistant answer.
        </p>
      </Card>
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
                          disabled={busy === `${role}:${permission}`}
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
        {(query.data?.roles ?? []).length === 0 ? <EmptyHint text="No role permissions configured." /> : null}
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
          <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 text-sm last:border-0">
            <span className="font-mono text-xs">{a.action}</span>
            <Badge variant={a.severity === "high" ? "destructive" : "secondary"}>{a.severity}</Badge>
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
            Sent messages can never be edited or deleted — a database trigger rejects every attempt, including by
            administrators.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Participant-only access
          </h3>
          <p className="text-sm text-muted-foreground">
            Conversations, messages, files, reactions and receipts are readable only by participants; chat managers
            additionally hold review access through role permissions.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ScrollText className="h-4 w-4 text-primary" /> Audited governance
          </h3>
          <p className="text-sm text-muted-foreground">
            Every AI reply, escalation and permission change writes an audit record with the acting user.
          </p>
        </Card>
        <Card>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Least privilege
          </h3>
          <p className="text-sm text-muted-foreground">
            Assignment, moderation and export are separate permissions, so support staff can work without gaining
            administrative control.
          </p>
        </Card>
      </div>
    </div>
  );
}

export function Participants() {
  const query = useOverview();
  const rows = query.data?.conversations ?? [];
  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Participants"
        description="Membership load across conversations, used to spot unbalanced routing."
      />
      {query.error ? <ErrorState message={query.error.message} /> : null}
      <Card>
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b border-border/60 py-2 text-sm last:border-0">
            <span className="truncate">{c.subject}</span>
            <span className="text-muted-foreground">{c.participants} people</span>
          </div>
        ))}
        {rows.length === 0 ? <EmptyHint text="No conversations yet." /> : null}
      </Card>
    </div>
  );
}

export function ActivityFeed() {
  return <AuditTrail />;
}
