import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Agent, Lead, LeadStatus } from "@/lib/lead-manager/types";
import {
  EmptyState,
  LoadingRows,
  PriorityBadge,
  ScoreBar,
  StatusBadge,
  TemperatureBadge,
  inr,
  maskEmail,
  maskPhone,
  relTime,
} from "./shared";

export function LeadTable({
  leads,
  agents,
  isLoading,
  onSelect,
  unmasked = true,
  emptyTitle = "No leads match this view",
  emptyDescription,
  columns = ["source", "status", "priority", "agent", "score", "value", "created"],
}: {
  leads: Lead[];
  agents: Agent[];
  isLoading?: boolean;
  onSelect: (lead: Lead) => void;
  unmasked?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  columns?: (
    | "source"
    | "status"
    | "priority"
    | "temperature"
    | "agent"
    | "score"
    | "intent"
    | "value"
    | "created"
    | "contact"
    | "followup"
  )[];
}) {
  if (isLoading) return <LoadingRows rows={8} />;
  if (leads.length === 0)
    return <EmptyState title={emptyTitle} {...(emptyDescription ? { description: emptyDescription } : {})} />;

  const head: Record<string, string> = {
    source: "Source",
    status: "Status",
    priority: "Priority",
    temperature: "Temp.",
    agent: "Agent",
    score: "AI score",
    intent: "Intent",
    value: "Deal value",
    created: "Created",
    contact: "Contact",
    followup: "Next follow-up",
  };
  const rightAligned = new Set(["value", "created", "followup"]);

  return (
    <div className="-mx-1 max-h-[70vh] overflow-auto rounded-xl border border-border/60">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-surface-2/85 backdrop-blur-md">
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Lead
            </TableHead>
            {columns.map((c) => (
              <TableHead
                key={c}
                className={`text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground ${
                  rightAligned.has(c) ? "text-right" : ""
                }`}
              >
                {head[c]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, i) => (
            <TableRow
              key={lead.id}
              tabIndex={0}
              role="button"
              className="rise cursor-pointer border-border/50 transition-colors duration-200 hover:bg-primary/8 focus-visible:bg-primary/10"
              style={{ animationDelay: `${Math.min(i, 14) * 22}ms` }}
              onClick={() => onSelect(lead)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(lead);
                }
              }}
            >
              <TableCell className="min-w-52">
                <p className="font-medium tracking-tight">{lead.name}</p>
                <p className="text-xs text-muted-foreground">
                  {lead.company ?? lead.industry} • {[lead.city, lead.state].filter(Boolean).join(", ")}
                </p>
              </TableCell>

              {columns.map((c) => {
                switch (c) {
                  case "source":
                    return (
                      <TableCell key={c} className="text-sm">
                        {lead.sub_source}
                        <span className="block text-xs text-muted-foreground">{lead.source}</span>
                      </TableCell>
                    );
                  case "status":
                    return (
                      <TableCell key={c}>
                        <StatusBadge status={lead.status as LeadStatus} />
                      </TableCell>
                    );
                  case "priority":
                    return (
                      <TableCell key={c}>
                        <PriorityBadge priority={lead.priority} />
                      </TableCell>
                    );
                  case "temperature":
                    return (
                      <TableCell key={c}>
                        <TemperatureBadge temperature={lead.temperature} />
                      </TableCell>
                    );
                  case "agent":
                    return (
                      <TableCell key={c} className="text-sm">
                        {agents.find((a) => a.id === lead.assigned_agent_id)?.name ?? "Unassigned"}
                      </TableCell>
                    );
                  case "score":
                    return (
                      <TableCell key={c}>
                        <ScoreBar score={lead.ai_score} />
                      </TableCell>
                    );
                  case "intent":
                    return (
                      <TableCell key={c}>
                        <ScoreBar score={lead.intent_score} label="Intent" />
                      </TableCell>
                    );
                  case "contact":
                    return (
                      <TableCell key={c} className="text-xs">
                        <span className="block">{maskEmail(lead.email, unmasked)}</span>
                        <span className="block text-muted-foreground">
                          {maskPhone(lead.phone, unmasked)}
                        </span>
                      </TableCell>
                    );
                  case "value":
                    return (
                      <TableCell key={c} className="text-right font-mono text-sm">
                        {inr(lead.deal_value)}
                      </TableCell>
                    );
                  case "followup":
                    return (
                      <TableCell key={c} className="text-right text-xs text-muted-foreground">
                        {relTime(lead.next_follow_up)}
                      </TableCell>
                    );
                  default:
                    return (
                      <TableCell key={c} className="text-right text-xs text-muted-foreground">
                        {relTime(lead.created_at)}
                      </TableCell>
                    );
                }
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
