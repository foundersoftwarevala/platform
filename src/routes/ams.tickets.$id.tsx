import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft, Send, Pin, MessageSquare, Activity, Paperclip, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { getTicket, changeStatus, addComment, postChatMessage, archiveTicket, toggleChatPin } from "@/lib/ams/tickets.functions";
import {
  AMS_STATUSES, AMS_CHAT_CHANNELS, STATUS_META, PRIORITY_META,
  type AmsStatus, type AmsChatChannel,
} from "@/lib/ams/tickets.types";

export const Route = createFileRoute("/ams/tickets/$id")({
  head: () => ({
    meta: [
      { title: "Ticket — AMS" },
      { name: "description", content: "It may have been deleted or you don't have access." },
      { property: "og:title", content: "Ticket — AMS" },
      { property: "og:description", content: "It may have been deleted or you don't have access." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TicketPage,
});

function TicketPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ams", "ticket", id], queryFn: () => getTicket({ data: { id } }) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["ams", "ticket", id] });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading ticket…</div>;
  if (!data) return <EmptyState title="Ticket not found" description="It may have been deleted or you don't have access." />;
  const t = data.ticket;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2"><Link to="/ams/ams"><ChevronLeft className="h-4 w-4" /> Back to tickets</Link></Button>

      <PageHeader
        kicker={t.ticket_no}
        title={t.subject}
        description={t.description ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Select value={t.status} onValueChange={async (v) => { await changeStatus({ data: { id, to: v as AmsStatus } }); toast.success("Status updated"); invalidate(); }}>
              <SelectTrigger className="h-9 w-44" aria-label="Ticket status"><SelectValue /></SelectTrigger>
              <SelectContent>{AMS_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={async () => { await archiveTicket({ data: { id } }); toast.success("Archived"); invalidate(); }}>Archive</Button>
          </div>
        }
      />

      {/* Meta strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Meta label="Status"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_META[t.status].tone}`}>{STATUS_META[t.status].label}</span></Meta>
        <Meta label="Priority"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_META[t.priority].tone}`}>{PRIORITY_META[t.priority].label}</span></Meta>
        <Meta label="Product">{t.product ?? "—"}</Meta>
        <Meta label="Category">{t.category ?? "—"}</Meta>
        <Meta label="Department">{t.department ?? "—"}</Meta>
        <Meta label="Team">{t.team ?? "—"}</Meta>
        <Meta label="Expected">{t.expected_resolution_at ? new Date(t.expected_resolution_at).toLocaleString() : "—"}</Meta>
        <Meta label="Created">{new Date(t.created_at).toLocaleString()}</Meta>
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
          <TabsTrigger value="comments" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Comments</TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Chat</TabsTrigger>
          <TabsTrigger value="attachments" className="gap-1.5"><Paperclip className="h-3.5 w-3.5" /> Files</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <div className="surface-card overflow-hidden">
            {data.events.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {data.events.map((e) => (
                  <li key={e.id} className="px-5 py-3 flex items-center gap-4 text-sm">
                    <div className="w-32 capitalize text-xs text-muted-foreground">{e.kind.replace(/_/g, " ")}</div>
                    <div className="flex-1 text-xs">
                      {e.from_value && <span className="text-muted-foreground">from </span>}
                      {e.from_value && <span className="font-medium">{e.from_value}</span>}
                      {e.from_value && e.to_value && <span className="text-muted-foreground"> → </span>}
                      {e.to_value && <span className="font-medium">{e.to_value}</span>}
                    </div>
                    <time className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="comments" className="mt-4 space-y-4">
          <CommentComposer id={id} onPosted={invalidate} />
          <div className="space-y-2">
            {data.comments.length === 0 ? (
              <EmptyState title="No comments yet" />
            ) : data.comments.map((c) => (
              <div key={c.id} className={`surface-card p-4 ${c.is_internal ? "ring-1 ring-amber-500/40" : ""}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs text-muted-foreground">{c.is_internal && <span className="inline-flex items-center gap-1 mr-2 text-amber-400"><ShieldAlert className="h-3 w-3" /> Internal</span>}{new Date(c.created_at).toLocaleString()}</div>
                </div>
                <div className="text-sm whitespace-pre-wrap">{c.body}</div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ChatPanel id={id} messages={data.chat} onChanged={invalidate} />
        </TabsContent>

        <TabsContent value="attachments" className="mt-4">
          {data.attachments.length === 0 ? <EmptyState title="No files attached" /> : (
            <ul className="divide-y divide-border surface-card overflow-hidden">
              {data.attachments.map((a) => (
                <li key={a.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                  <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:text-trophy">{a.file_name}</a>
                  <span className="ml-auto text-xs text-muted-foreground">{(a.file_size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function CommentComposer({ id, onPosted }: { id: string; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="surface-card p-4 space-y-3">
      <Label htmlFor={`comment-${id}`} className="sr-only">{internal ? "Internal note" : "Comment"}</Label>
      <Textarea
        id={`comment-${id}`}
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-describedby={`comment-${id}-hint`}
        placeholder={internal ? "Internal note — not visible to the customer" : "Write a comment…"}
      />
      <p id={`comment-${id}-hint`} className="sr-only">Toggle internal note to keep this comment hidden from the customer.</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch id="internal" checked={internal} onCheckedChange={setInternal} />
          <Label htmlFor="internal" className="text-xs">Internal note</Label>
        </div>
        <Button
          size="sm" className="gap-1.5" disabled={!body.trim() || busy}
          onClick={async () => {
            setBusy(true);
            try { await addComment({ data: { ticket_id: id, body, is_internal: internal } }); setBody(""); toast.success("Posted"); onPosted(); }
            catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
            finally { setBusy(false); }
          }}
        >
          <Send className="h-3.5 w-3.5" /> Post
        </Button>
      </div>
    </div>
  );
}

function ChatPanel({ id, messages, onChanged }: { id: string; messages: Array<{ id: string; channel: AmsChatChannel; body: string; pinned: boolean; created_at: string }>; onChanged: () => void }) {
  const [channel, setChannel] = useState<AmsChatChannel>("support");
  const [body, setBody] = useState("");
  const visible = messages.filter((m) => m.channel === channel);
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Chat channels" className="flex items-center gap-2 flex-wrap">
        {AMS_CHAT_CHANNELS.map((c) => (
          <button key={c} type="button" aria-pressed={channel === c} title={`Open #${c}`} onClick={() => setChannel(c)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${channel === c ? "bg-trophy text-background" : "bg-muted/40 text-muted-foreground hover:text-foreground"}`}>
            {c}
          </button>
        ))}
      </div>
      <div
        role="log"
        aria-label={`Messages in ${channel}`}
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        className="surface-card max-h-[420px] overflow-y-auto p-4 space-y-3"
      >
        {visible.length === 0 ? <div className="text-sm text-muted-foreground text-center py-8">No messages in #{channel} yet.</div> :
          visible.map((m) => (
            <div key={m.id} className="flex items-start gap-3">
              <div className="flex-1 rounded-lg bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
                  <span>{new Date(m.created_at).toLocaleString()}</span>
                  {m.pinned && <span className="text-trophy inline-flex items-center gap-1"><Pin className="h-2.5 w-2.5" /> pinned</span>}
                </div>
                <div className="whitespace-pre-wrap">{m.body}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" title={m.pinned ? "Unpin message" : "Pin message"} aria-label={m.pinned ? "Unpin message" : "Pin message"} aria-pressed={m.pinned}
                onClick={async () => { await toggleChatPin({ data: { id: m.id, pinned: !m.pinned } }); onChanged(); }}>
                <Pin className={`h-3.5 w-3.5 ${m.pinned ? "text-trophy" : "text-muted-foreground"}`} />
              </Button>
            </div>
          ))
        }
      </div>
      <div className="flex items-end gap-2">
        <Label htmlFor={`chat-input-${id}`} className="sr-only">{`Message #${channel}`}</Label>
        <Input id={`chat-input-${id}`} autoComplete="off" aria-label={`Message #${channel}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Message #${channel}…`}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && body.trim()) {
              await postChatMessage({ data: { ticket_id: id, channel, body } });
              setBody(""); onChanged();
            }
          }} />
        <Button onClick={async () => { if (body.trim()) { await postChatMessage({ data: { ticket_id: id, channel, body } }); setBody(""); onChanged(); } }}
          className="gap-1.5"><Send className="h-4 w-4" /> Send</Button>
      </div>
    </div>
  );
}
