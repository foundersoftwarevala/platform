import { useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgents, useLeads } from "@/lib/lead-manager/queries";
import { PIPELINE_STAGES, type Lead } from "@/lib/lead-manager/types";
import { LeadTable } from "../LeadTable";
import { Panel, exportLeadsCsv } from "../shared";
import { printReport } from "./common";

const SOURCES = ["website", "seo", "social", "ads", "marketplace", "referral", "manual", "api", "whatsapp"];

export function AllLeadsScreen({ onSelect }: { onSelect: (lead: Lead) => void }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [priority, setPriority] = useState("all");
  const [temperature, setTemperature] = useState("all");
  const [agentId, setAgentId] = useState("all");

  const { data: leads = [], isLoading } = useLeads({ search });
  const { data: agents = [] } = useAgents();

  const rows = useMemo(
    () =>
      leads.filter(
        (l) =>
          (status === "all" || l.status === status) &&
          (source === "all" || l.source === source) &&
          (priority === "all" || l.priority === priority) &&
          (temperature === "all" || l.temperature === temperature) &&
          (agentId === "all" ||
            (agentId === "unassigned" ? !l.assigned_agent_id : l.assigned_agent_id === agentId)),
      ),
    [leads, status, source, priority, temperature, agentId],
  );

  return (
    <Panel
      title={`Master lead table — ${rows.length} leads`}
      description="Every lead in the database with full filtering, masking-aware contact columns and export."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => exportLeadsCsv(rows, "all-leads")}>
            <Download className="size-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => printReport("All Leads")}>
            PDF
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, company, city…"
            className="w-64 pl-8"
          />
        </div>
        <Filter value={status} onChange={setStatus} label="Status" options={PIPELINE_STAGES.map((s) => [s.id, s.label])} extra={[["spam", "Spam"]]} />
        <Filter value={source} onChange={setSource} label="Source" options={SOURCES.map((s) => [s, s])} />
        <Filter
          value={priority}
          onChange={setPriority}
          label="Priority"
          options={[["critical", "Critical"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]]}
        />
        <Filter
          value={temperature}
          onChange={setTemperature}
          label="Temperature"
          options={[["hot", "Hot"], ["warm", "Warm"], ["cold", "Cold"]]}
        />
        <Filter
          value={agentId}
          onChange={setAgentId}
          label="Agent"
          options={agents.map((a) => [a.id, a.name] as [string, string])}
          extra={[["unassigned", "Unassigned"]]}
        />
      </div>

      <LeadTable
        leads={rows}
        agents={agents}
        isLoading={isLoading}
        onSelect={onSelect}
        columns={["contact", "source", "status", "priority", "agent", "score", "value", "created"]}
      />
    </Panel>
  );
}

function Filter({
  value,
  onChange,
  label,
  options,
  extra = [],
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: [string, string][];
  extra?: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-40 capitalize">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All {label.toLowerCase()}</SelectItem>
        {[...options, ...extra].map(([id, l]) => (
          <SelectItem key={id} value={id} className="capitalize">
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
