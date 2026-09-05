import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Brain,
  Calendar,
  Mail,
  MessageCircle,
  Phone,
  Trash2,
  UserCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { leadApi } from "@/lib/lead-manager/api";
import {
  leadKeys,
  useAgents,
  useLeadCommunications,
  useLeadNotes,
} from "@/lib/lead-manager/queries";
import { PIPELINE_STAGES, type Lead, type LeadStatus } from "@/lib/lead-manager/types";
import {
  PriorityBadge,
  ScoreBar,
  StatusBadge,
  TemperatureBadge,
  dateTime,
  inr,
  relTime,
} from "./shared";

export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: agents = [] } = useAgents();
  const { data: notes = [] } = useLeadNotes(lead?.id ?? null);
  const { data: comms = [] } = useLeadCommunications(lead?.id ?? null);

  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpType, setFollowUpType] = useState("call");
  const [lostReason, setLostReason] = useState("");
  const [edit, setEdit] = useState<Partial<Lead>>({});

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lm"] });
  };

  const run = async <T,>(fn: () => Promise<T>, success: string) => {
    try {
      const result = await fn();
        toast.success(success);
      await qc.invalidateQueries({ queryKey: ["lm"] });
      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
      return undefined;
    }
  };

  const mutation = useMutation({
    mutationFn: async (task: () => Promise<unknown>) => task(),
    onSuccess: () => invalidate(),
  });

  if (!lead) return null;
  const agent = agents.find((a) => a.id === lead.assigned_agent_id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto bg-surface sm:max-w-2xl">
        <SheetHeader className="gap-2">
          <SheetTitle className="font-display text-xl">{lead.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={lead.status as LeadStatus} />
            <PriorityBadge priority={lead.priority} />
            <TemperatureBadge temperature={lead.temperature} />
            <span className="text-xs text-muted-foreground">
              {lead.sub_source} • created {relTime(lead.created_at)}
            </span>
          </div>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-8">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="stat-tile p-3">
              <ScoreBar score={lead.ai_score} label="AI score" />
            </div>
            <div className="stat-tile p-3">
              <ScoreBar score={lead.intent_score} label="Intent" />
            </div>
            <div className="stat-tile p-3">
              <ScoreBar score={lead.conversion_probability} label="Conv. prob." />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                run(
                  () =>
                    leadApi.logCommunication({
                      lead_id: lead.id,
                      type: "call",
                      content: `Outbound call placed to ${lead.phone}`,
                    }),
                  "Call logged",
                ).then((result) => result && window.open(`tel:${lead.phone}`, "_self"))
              }
            >
              <Phone className="size-4" /> Call
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    leadApi.logCommunication({
                      lead_id: lead.id,
                      type: "whatsapp",
                      content: message || `WhatsApp conversation opened with ${lead.name}`,
                    }),
                  "WhatsApp logged",
                ).then((result) =>
                  result && window.open(
                    `https://wa.me/${lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(message || `Hi ${lead.name}, following up on your enquiry.`)}`,
                    "_blank",
                  ),
                )
              }
            >
              <MessageCircle className="size-4" /> WhatsApp
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    leadApi.logCommunication({
                      lead_id: lead.id,
                      type: "email",
                      subject: "Following up on your enquiry",
                      content: message || `Email sent to ${lead.email}`,
                    }),
                  "Email logged",
                ).then((result) => result && window.open(`mailto:${lead.email}`, "_self"))
              }
            >
              <Mail className="size-4" /> Email
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run(() => leadApi.rescoreLead(lead.id), "Lead re-scored by AI")}
            >
              <Brain className="size-4" /> Re-score
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => run(() => leadApi.changeStatus(lead.id, "won"), "Converted to client")}
            >
              <UserCheck className="size-4" /> Convert
            </Button>
          </div>

          <Tabs defaultValue="details">
            <TabsList className="w-full">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="actions">Actions</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-3 text-sm">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Company" value={lead.company ?? "—"} />
              <Field label="Industry / Category" value={`${lead.industry} • ${lead.category}`} />
              <Field
                label="Location"
                value={[lead.city, lead.state, lead.country].filter(Boolean).join(", ")}
              />
              <Field label="Source" value={`${lead.source} • ${lead.sub_source}`} />
              <Field label="Campaign" value={lead.campaign ?? "—"} />
              <Field label="Budget" value={lead.budget_range ?? "—"} />
              <Field label="Deal value" value={inr(lead.deal_value)} />
              <Field label="Assigned to" value={agent ? `${agent.name} (${agent.team})` : "Unassigned"} />
              <Field label="Last contact" value={dateTime(lead.last_contact_at)} />
              <Field label="Next follow-up" value={dateTime(lead.next_follow_up)} />
              <Field label="Device / language" value={`${lead.device} • ${lead.language}`} />
              <Field label="Requirements" value={lead.requirements ?? "—"} />
              {lead.lost_reason ? <Field label="Lost reason" value={lead.lost_reason} /> : null}
              {lead.is_duplicate ? (
                <Field label="Duplicate score" value={`${lead.duplicate_score}%`} />
              ) : null}
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Add note</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Log what happened on this lead…"
                />
                <Button
                  size="sm"
                  disabled={!note.trim()}
                  onClick={() =>
                    run(() => leadApi.addNote(lead.id, note), "Note saved").then((result) => result && setNote(""))
                  }
                >
                  Save note
                </Button>
              </div>
              <Separator />
              <div className="space-y-3">
                {comms.map((c) => (
                  <div key={c.id} className="rounded-md border border-border bg-surface-2 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="uppercase tracking-wide">
                        {c.type} • {c.direction}
                      </span>
                      <span>{dateTime(c.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{c.content}</p>
                  </div>
                ))}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-md border border-border bg-surface-2 p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Note • {n.created_by}</span>
                      <span>{dateTime(n.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm">{n.content}</p>
                  </div>
                ))}
                {comms.length === 0 && notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="actions" className="mt-4 space-y-5">
              <div className="space-y-2">
                <Label>Assign / reassign</Label>
                <Select
                  value={lead.assigned_agent_id ?? ""}
                  onValueChange={(v) =>
                    run(() => leadApi.assignLead(lead.id, v), "Lead assigned")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.team} ({a.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Change stage</Label>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((s) => (
                    <Button
                      key={s.id}
                      size="sm"
                      variant={lead.status === s.id ? "default" : "outline"}
                      onClick={() =>
                        run(() => leadApi.changeStatus(lead.id, s.id), `Moved to ${s.label}`)
                      }
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Schedule follow-up</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="datetime-local"
                    className="max-w-56"
                    value={followUpAt}
                    onChange={(e) => setFollowUpAt(e.target.value)}
                  />
                  <Select value={followUpType} onValueChange={setFollowUpType}>
                    <SelectTrigger className="max-w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["call", "whatsapp", "email", "meeting"].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={!followUpAt}
                    onClick={() =>
                      run(
                        () =>
                          leadApi.scheduleFollowUp({
                            lead_id: lead.id,
                            agent_id: lead.assigned_agent_id,
                            scheduled_at: new Date(followUpAt).toISOString(),
                            follow_up_type: followUpType,
                            notes: note || null,
                          }),
                        "Follow-up scheduled",
                      )
                    }
                  >
                    <Calendar className="size-4" /> Schedule
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mark lost</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    className="max-w-72"
                    placeholder="Reason (budget, competitor, no response…)"
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!lostReason.trim()}
                    onClick={() =>
                      run(
                        () => leadApi.changeStatus(lead.id, "lost", lostReason),
                        "Lead marked lost",
                      )
                    }
                  >
                    <XCircle className="size-4" /> Mark lost
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Outbound message draft</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Used when you send WhatsApp / email from the quick actions above"
                />
              </div>

              <Separator />
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  run(() => leadApi.deleteLead(lead.id, lead.name), "Lead deleted").then((result) => {
                    if (result !== undefined) onOpenChange(false);
                  })
                }
              >
                <Trash2 className="size-4" /> Delete lead
              </Button>
            </TabsContent>

            <TabsContent value="edit" className="mt-4 space-y-3">
              {(
                [
                  ["name", "Name"],
                  ["email", "Email"],
                  ["phone", "Phone"],
                  ["company", "Company"],
                  ["city", "City"],
                  ["state", "State"],
                  ["budget_range", "Budget range"],
                  ["requirements", "Requirements"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    defaultValue={(lead[key] as string) ?? ""}
                    onChange={(e) => setEdit((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label>Deal value (INR)</Label>
                <Input
                  type="number"
                  defaultValue={lead.deal_value}
                  onChange={(e) => setEdit((p) => ({ ...p, deal_value: Number(e.target.value) }))}
                />
              </div>
              <Button
                size="sm"
                disabled={Object.keys(edit).length === 0 || mutation.isPending}
                onClick={() =>
                  run(() => leadApi.updateLead(lead.id, edit), "Lead updated").then((result) => result && setEdit({}))
                }
              >
                <UserCog className="size-4" /> Save changes
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border/60 pb-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="max-w-[60%] text-right text-sm">{value}</span>
    </div>
  );
}
