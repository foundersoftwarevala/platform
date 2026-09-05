import { useMemo, useState } from "react";
import {
  Calendar,
  Edit,
  Eye,
  GitBranch,
  Mail,
  MessageCircle,
  Phone,
  UserCheck,
  UserCog,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgents, useLeads, useRecentCommunications } from "@/lib/lead-manager/queries";
import { leadApi } from "@/lib/lead-manager/api";
import { PIPELINE_STAGES, type Lead, type LeadStatus } from "@/lib/lead-manager/types";
import { Panel, StatCard, StatusBadge, inr, num, relTime } from "../shared";
import { agentNameMap, leadNameMap, useAction } from "./common";

const ACTIONS = [
  { id: "view_lead", label: "View", description: "Open the full lead workspace", icon: Eye },
  { id: "edit_lead", label: "Edit", description: "Edit lead information", icon: Edit },
  { id: "assign_lead", label: "Assign", description: "Assign to an agent", icon: UserCog },
  { id: "reassign_lead", label: "Reassign", description: "Move to a different agent", icon: GitBranch },
  { id: "call_lead", label: "Call", description: "Place and log a call", icon: Phone },
  { id: "whatsapp_lead", label: "WhatsApp", description: "Send a WhatsApp message", icon: MessageCircle },
  { id: "email_lead", label: "Email", description: "Send an email", icon: Mail },
  { id: "schedule_followup", label: "Schedule Follow-Up", description: "Book the next touchpoint", icon: Calendar },
  { id: "convert_client", label: "Convert to Client", description: "Mark the deal won", icon: UserCheck },
  { id: "mark_lost", label: "Mark Lost", description: "Close with a lost reason", icon: XCircle },
];

export function ActionsScreen({
  section,
  onSelect,
}: {
  section: string;
  onSelect: (lead: Lead) => void;
}) {
  const { data: leads = [] } = useLeads();
  const { data: agents = [] } = useAgents();
  const { data: comms = [] } = useRecentCommunications();
  const run = useAction();

  const [picked, setPicked] = useState<string[]>([]);
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState<LeadStatus>("contacted");
  const [lostReason, setLostReason] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");

  const open = useMemo(() => leads.filter((l) => !["won", "lost", "spam"].includes(l.status)).slice(0, 60), [leads]);
  const selectedLeads = leads.filter((l) => picked.includes(l.id));
  const agentNames = agentNameMap(agents);
  const leadNames = leadNameMap(leads);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const bulk = (fn: (lead: Lead) => Promise<unknown>, message: string) =>
    run(async () => {
      for (const lead of selectedLeads) await fn(lead);
      setPicked([]);
    }, message);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Actionable leads" value={num(open.length)} icon={UserCog} />
        <StatCard label="Selected" value={num(picked.length)} tone="info" />
        <StatCard label="Touchpoints logged" value={num(comms.length)} tone="success" />
        <StatCard label="Pipeline value selected" value={inr(selectedLeads.reduce((a, l) => a + (l.deal_value ?? 0), 0))} tone="warning" />
      </div>

      <Panel title="Action catalog" description="Every lead action available in the console — all writes hit the live database.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {ACTIONS.map((a) => (
            <div
              key={a.id}
              className={`rounded-md border p-3 ${section === a.id ? "border-primary bg-primary/10" : "border-border bg-surface-2"}`}
            >
              <a.icon className="size-4 text-primary" />
              <p className="mt-2 text-sm font-medium">{a.label}</p>
              <p className="text-xs text-muted-foreground">{a.description}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title="Bulk actions"
        description="Select leads below, then apply an action to the whole selection."
        actions={<Badge variant="outline">{picked.length} selected</Badge>}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label>Assign / reassign</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {a.team}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!agentId || picked.length === 0}
                onClick={() => bulk((l) => leadApi.assignLead(l.id, agentId), "Leads assigned")}
              >
                Assign
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={picked.length === 0}
                onClick={() => bulk((l) => leadApi.autoAssign(l.id), "Leads auto-routed")}
              >
                Auto-route
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Change stage</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={picked.length === 0}
              onClick={() => bulk((l) => leadApi.changeStatus(l.id, status), "Stage updated")}
            >
              Apply stage
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Schedule follow-up</Label>
            <Input type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
            <Button
              size="sm"
              disabled={!followUpAt || picked.length === 0}
              onClick={() =>
                bulk(
                  (l) =>
                    leadApi.scheduleFollowUp({
                      lead_id: l.id,
                      agent_id: l.assigned_agent_id,
                      scheduled_at: new Date(followUpAt).toISOString(),
                      follow_up_type: "call",
                      notes: null,
                    }),
                  "Follow-ups scheduled",
                )
              }
            >
              Schedule
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Close out</Label>
            <Input placeholder="Lost reason" value={lostReason} onChange={(e) => setLostReason(e.target.value)} />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={picked.length === 0}
                onClick={() => bulk((l) => leadApi.changeStatus(l.id, "won"), "Converted to clients")}
              >
                <UserCheck className="size-4" /> Convert
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={picked.length === 0 || !lostReason.trim()}
                onClick={() => bulk((l) => leadApi.changeStatus(l.id, "lost", lostReason), "Marked lost")}
              >
                <XCircle className="size-4" /> Lost
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title={`Open leads — ${open.length}`} description="Tick leads to build a selection, or open one for the full workspace.">
        <div className="space-y-2">
          {open.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-2 p-3">
              <Checkbox checked={picked.includes(l.id)} onCheckedChange={() => toggle(l.id)} />
              <button className="min-w-40 flex-1 text-left" onClick={() => onSelect(l)}>
                <p className="text-sm font-medium">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  {l.sub_source} • {agentNames.get(l.assigned_agent_id ?? "") ?? "Unassigned"} • {relTime(l.created_at)}
                </p>
              </button>
              <StatusBadge status={l.status as LeadStatus} />
              <span className="font-mono text-xs">{inr(l.deal_value)}</span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="size-8" onClick={() => onSelect(l)} aria-label="View lead">
                  <Eye className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Call lead"
                  onClick={() =>
                    run(
                      () => leadApi.logCommunication({ lead_id: l.id, type: "call", content: `Outbound call placed to ${l.phone}` }),
                      "Call logged",
                    ).then((result) => result && window.open(`tel:${l.phone}`, "_self"))
                  }
                >
                  <Phone className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="WhatsApp lead"
                  onClick={() =>
                    run(
                      () => leadApi.logCommunication({ lead_id: l.id, type: "whatsapp", content: `WhatsApp conversation opened with ${l.name}` }),
                      "WhatsApp logged",
                    ).then((result) =>
                      result && window.open(
                        `https://wa.me/${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${l.name}, following up on your enquiry.`)}`,
                        "_blank",
                      ),
                    )
                  }
                >
                  <MessageCircle className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  aria-label="Email lead"
                  onClick={() =>
                    run(
                      () =>
                        leadApi.logCommunication({
                          lead_id: l.id,
                          type: "email",
                          subject: "Following up on your enquiry",
                          content: `Email sent to ${l.email}`,
                        }),
                      "Email logged",
                    ).then((result) => result && window.open(`mailto:${l.email}`, "_self"))
                  }
                >
                  <Mail className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Recent activity" description="Latest calls, WhatsApp messages and emails logged by the team.">
        <div className="space-y-2">
          {comms.slice(0, 12).map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{leadNames.get(c.lead_id) ?? "Lead"}</span> — {c.content}
              </span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {c.type} • {c.direction} • {relTime(c.created_at)}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
