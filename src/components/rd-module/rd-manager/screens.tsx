import { useMemo, useState } from "react";
import {
  Inbox,
  Sparkles,
  AlertTriangle,
  FlaskConical,
  Beaker,
  CheckCircle2,
  XCircle,
  Send,
  Handshake,
  Rocket,
  Lightbulb,
} from "lucide-react";
import { Input } from "@/components/rd-module/ui/input";
import {
  PMBadge,
  PMEmpty,
  PMLoading,
  PMPanel,
  PMSection,
  PMStat,
  StatusBadge,
  formatDate,
  formatDay,
} from "@/components/rd-module/pro-manager/pm-ui";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  PRIORITIES,
  TYPE_LABEL,
  EVALUATION_AREAS,
  type Evaluation,
  type Opportunity,
  type OpportunityType,
  type RdProject,
} from "@/lib/rd-module/rd-opportunity-types";

const selectCls =
  "flex h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground";

function count<T>(items: T[], key: (t: T) => string | string[]) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    for (const v of Array.isArray(k) ? k : [k]) if (v) m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Bars({ rows, empty = "No data yet" }: { rows: [string, number][]; empty?: string }) {
  if (rows.length === 0) return <PMEmpty message={empty} />;
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <ul className="space-y-2">
      {rows.slice(0, 10).map(([label, n]) => (
        <li key={label} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="truncate text-foreground">{label}</span>
            <span className="font-mono text-muted-foreground">{n}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-brand" style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RdDashboard({
  items,
  loading,
  onOpen,
  onFilter,
}: {
  items: Opportunity[];
  loading: boolean;
  onOpen: (id: string) => void;
  onFilter: (status?: string, type?: OpportunityType) => void;
}) {
  const by = (s: string) => items.filter((o) => o.status === s).length;
  const stats = [
    { label: "New requests", value: by("NEW"), icon: Inbox, tone: "brand" as const, s: "NEW" },
    {
      label: "Under review",
      value: by("UNDER_REVIEW"),
      icon: Sparkles,
      tone: "warning" as const,
      s: "UNDER_REVIEW",
    },
    {
      label: "High priority",
      value: items.filter((o) => o.priority === "high" || o.priority === "critical").length,
      icon: AlertTriangle,
      tone: "danger" as const,
    },
    {
      label: "Active research",
      value: by("RESEARCHING") + by("FEASIBILITY") + by("EXPERIMENT"),
      icon: FlaskConical,
      tone: "info" as const,
      s: "RESEARCHING",
    },
    { label: "POC", value: by("POC"), icon: Beaker, tone: "info" as const, s: "POC" },
    {
      label: "Approved",
      value: by("APPROVED"),
      icon: CheckCircle2,
      tone: "success" as const,
      s: "APPROVED",
    },
    {
      label: "Rejected",
      value: by("REJECTED"),
      icon: XCircle,
      tone: "danger" as const,
      s: "REJECTED",
    },
    {
      label: "Development handoff",
      value: by("DEVELOPMENT_HANDOFF"),
      icon: Send,
      tone: "success" as const,
      s: "DEVELOPMENT_HANDOFF",
    },
    {
      label: "SaaS partnerships",
      value: items.filter((o) => o.type === "SAAS_PARTNERSHIP").length,
      icon: Handshake,
      tone: "brand" as const,
      t: "SAAS_PARTNERSHIP" as const,
    },
    {
      label: "Software demand",
      value: items.filter((o) => o.type === "SOFTWARE_ON_DEMAND").length,
      icon: Rocket,
      tone: "brand" as const,
      t: "SOFTWARE_ON_DEMAND" as const,
    },
  ];
  return (
    <PMSection
      title="R&D Manager"
      description="Public Software On Demand, SaaS Partnership and Build With Us requests."
    >
      {loading ? (
        <PMLoading rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {stats.map((s) => (
              <PMStat
                key={s.label}
                label={s.label}
                value={s.value}
                icon={s.icon}
                tone={s.tone}
                onClick={() => onFilter("s" in s ? s.s : undefined, "t" in s ? s.t : undefined)}
              />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <PMPanel title="Latest requests" icon={Inbox}>
              {items.length === 0 ? (
                <PMEmpty message="No requests yet. Open /rd-manager/start to submit a request." />
              ) : (
                <ul className="space-y-2">
                  {items.slice(0, 6).map((o) => (
                    <OppRow key={o.id} o={o} onOpen={onOpen} />
                  ))}
                </ul>
              )}
            </PMPanel>
            <PMPanel title="Requests by type" icon={Lightbulb}>
              <Bars rows={count(items, (o) => TYPE_LABEL[o.type])} />
            </PMPanel>
          </div>
        </>
      )}
    </PMSection>
  );
}

function OppRow({ o, onOpen }: { o: Opportunity; onOpen: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(o.id)}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm text-foreground">
            <span className="font-mono text-xs text-brand">{o.public_request_id}</span> {o.title}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {TYPE_LABEL[o.type]} · {o.company || o.contact_name} · {o.country} ·{" "}
            {formatDay(o.created_at)}
          </span>
        </span>
        <span className="flex gap-1">
          <StatusBadge value={o.status} />
        </span>
      </button>
    </li>
  );
}

export interface InboxFilters {
  type: string;
  status: string;
  priority: string;
  country: string;
  category: string;
  assigned: string;
  from: string;
  q: string;
}
export const emptyFilters: InboxFilters = {
  type: "",
  status: "",
  priority: "",
  country: "",
  category: "",
  assigned: "",
  from: "",
  q: "",
};

export function RdInbox({
  items,
  loading,
  filters,
  setFilters,
  onOpen,
  title,
}: {
  items: Opportunity[];
  loading: boolean;
  filters: InboxFilters;
  setFilters: (f: InboxFilters) => void;
  onOpen: (id: string) => void;
  title: string;
}) {
  const countries = useMemo(
    () => [...new Set(items.map((o) => o.country).filter(Boolean))].sort(),
    [items],
  );
  const categories = useMemo(
    () => [...new Set(items.map((o) => o.category).filter(Boolean))].sort(),
    [items],
  );
  const assignees = useMemo(
    () => [...new Set(items.map((o) => o.assigned_to).filter(Boolean))].sort(),
    [items],
  );
  const q = filters.q.trim().toLowerCase();
  const rows = items.filter(
    (o) =>
      (!filters.type || o.type === filters.type) &&
      (!filters.status || o.status === filters.status) &&
      (!filters.priority || o.priority === filters.priority) &&
      (!filters.country || o.country === filters.country) &&
      (!filters.category || o.category === filters.category) &&
      (!filters.assigned || o.assigned_to === filters.assigned) &&
      (!filters.from || o.created_at >= filters.from) &&
      (!q ||
        [
          o.public_request_id,
          o.title,
          o.description,
          o.contact_name,
          o.company,
          o.contact_email,
          o.category,
          o.country,
        ].some((v) => v.toLowerCase().includes(q))),
  );
  const set =
    (k: keyof InboxFilters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) =>
      setFilters({ ...filters, [k]: e.target.value });
  return (
    <PMSection title={title} description={`${rows.length} of ${items.length} opportunities`}>
      <div className="panel grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          className="sm:col-span-2 lg:col-span-4"
          aria-label="Search"
          placeholder="Search by Request ID, title, name, company, email, category, country…"
          value={filters.q}
          onChange={set("q")}
        />
        <select aria-label="Type" className={selectCls} value={filters.type} onChange={set("type")}>
          <option value="">All types</option>
          {OPPORTUNITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          className={selectCls}
          value={filters.status}
          onChange={set("status")}
        >
          <option value="">All statuses</option>
          {OPPORTUNITY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          aria-label="Priority"
          className={selectCls}
          value={filters.priority}
          onChange={set("priority")}
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select
          aria-label="Country"
          className={selectCls}
          value={filters.country}
          onChange={set("country")}
        >
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Category"
          className={selectCls}
          value={filters.category}
          onChange={set("category")}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Assigned user"
          className={selectCls}
          value={filters.assigned}
          onChange={set("assigned")}
        >
          <option value="">Anyone assigned</option>
          {assignees.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Input
          type="date"
          aria-label="Submitted from"
          value={filters.from}
          onChange={set("from")}
        />
        <button
          type="button"
          className="min-h-10 rounded-md border border-border text-sm text-muted-foreground hover:bg-surface-2"
          onClick={() => setFilters({ ...emptyFilters })}
        >
          Clear filters
        </button>
      </div>
      {loading ? (
        <PMLoading rows={5} />
      ) : rows.length === 0 ? (
        <PMEmpty message="No opportunities match these filters." />
      ) : (
        <ul className="space-y-2">
          {rows.map((o) => (
            <OppRow key={o.id} o={o} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </PMSection>
  );
}

export function RdProjectsScreen({
  projects,
  items,
  kinds,
  title,
  onOpen,
}: {
  projects: RdProject[];
  items: Opportunity[];
  kinds: string[];
  title: string;
  onOpen: (id: string) => void;
}) {
  const byId = new Map(items.map((o) => [o.id, o]));
  const rows = projects.filter((p) => kinds.includes(p.kind));
  return (
    <PMSection title={title} description={`${rows.length} projects created from R&D opportunities`}>
      {rows.length === 0 ? (
        <PMEmpty message="No projects yet. Open an opportunity and use “Create project / convert”." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((p) => {
            const o = byId.get(p.opportunity_id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p.opportunity_id)}
                className="panel space-y-2 p-4 text-left hover:shadow-glow"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-display text-sm font-semibold text-foreground">
                    {p.name}
                  </span>
                  <span className="flex gap-1">
                    <PMBadge tone="info">{p.kind.replace(/_/g, " ")}</PMBadge>
                    <StatusBadge value={p.status} />
                  </span>
                </div>
                {p.objective && (
                  <p className="line-clamp-2 text-sm text-muted-foreground">{p.objective}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {o && <span className="font-mono text-brand">{o.public_request_id}</span>}{" "}
                  {p.owner && `· ${p.owner}`} {p.stage && `· ${p.stage}`} ·{" "}
                  {formatDate(p.created_at)}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </PMSection>
  );
}

export function RdEvaluationsScreen({
  evaluations,
  items,
  onOpen,
}: {
  evaluations: Evaluation[];
  items: Opportunity[];
  onOpen: (id: string) => void;
}) {
  const byId = new Map(items.map((o) => [o.id, o]));
  return (
    <PMSection title="Evaluations" description="Internal scoring — never visible to submitters.">
      {evaluations.length === 0 ? (
        <PMEmpty message="No evaluations saved yet." />
      ) : (
        <ul className="space-y-2">
          {evaluations.map((e) => {
            const o = byId.get(e.opportunity_id);
            const vals = EVALUATION_AREAS.map((a) => e.scores[a] ?? 0);
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpen(e.opportunity_id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5 text-left hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate text-sm text-foreground">
                    <span className="font-mono text-xs text-brand">{o?.public_request_id}</span>{" "}
                    {o?.title}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm text-brand">{avg.toFixed(1)}/10</span>
                    {e.decision && <PMBadge tone="info">{e.decision}</PMBadge>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </PMSection>
  );
}

export function RdClusters({
  items,
  onOpen,
}: {
  items: Opportunity[];
  onOpen: (id: string) => void;
}) {
  const clusters = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    for (const o of items)
      if (o.cluster_key) m.set(o.cluster_key, [...(m.get(o.cluster_key) ?? []), o]);
    return [...m.entries()]
      .filter(([, v]) => v.length > 1)
      .sort((a, b) => b[1].length - a[1].length);
  }, [items]);
  return (
    <PMSection
      title="Demand clusters"
      description="Similar requests grouped by keywords. Original requests stay separate."
    >
      {clusters.length === 0 ? (
        <PMEmpty message="No clusters yet — clusters appear when two or more similar requests arrive." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {clusters.map(([key, list]) => {
            const features = count(list, (o) =>
              String(o.details["features"] ?? "")
                .split(/\n|,/)
                .map((f) => f.trim().toLowerCase())
                .filter(Boolean),
            );
            return (
              <PMPanel
                key={key}
                title={list[0]?.title ?? key}
                description={`${list.length} related requests`}
              >
                <p className="text-xs text-muted-foreground">
                  Countries: {[...new Set(list.map((o) => o.country))].join(", ") || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Industries:{" "}
                  {[...new Set(list.map((o) => o.category).filter(Boolean))].join(", ") || "—"}
                </p>
                {features.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Common features:{" "}
                    {features
                      .slice(0, 5)
                      .map((f) => f[0])
                      .join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1">
                  {list.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onOpen(o.id)}
                      className="rounded-full border border-border px-2 py-0.5 font-mono text-xs text-brand hover:bg-surface-2"
                    >
                      {o.public_request_id}
                    </button>
                  ))}
                </div>
              </PMPanel>
            );
          })}
        </div>
      )}
    </PMSection>
  );
}

export function RdAnalytics({ items, projects }: { items: Opportunity[]; projects: RdProject[] }) {
  const sod = items.filter((o) => o.type === "SOFTWARE_ON_DEMAND");
  const reached = (statuses: string[]) => items.filter((o) => statuses.includes(o.status)).length;
  const funnel: [string, number][] = [
    ["Request", items.length],
    [
      "Research",
      reached([
        "RESEARCHING",
        "FEASIBILITY",
        "EXPERIMENT",
        "POC",
        "VALIDATED",
        "APPROVED",
        "DEVELOPMENT_HANDOFF",
        "PARTNERSHIP",
        "RD_PROJECT",
      ]),
    ],
    [
      "POC",
      reached(["POC", "VALIDATED", "APPROVED", "DEVELOPMENT_HANDOFF", "PARTNERSHIP", "RD_PROJECT"]),
    ],
    ["Approved", reached(["APPROVED", "DEVELOPMENT_HANDOFF", "PARTNERSHIP", "RD_PROJECT"])],
    ["Development", reached(["DEVELOPMENT_HANDOFF"])],
    [
      "Product",
      projects.filter((p) => p.kind === "DEVELOPMENT_HANDOFF" && p.status === "completed").length,
    ],
  ];
  return (
    <PMSection title="Demand analytics" description="Calculated live from stored submissions.">
      <div className="grid gap-4 lg:grid-cols-2">
        <PMPanel title="Conversion funnel">
          <Bars rows={funnel} />
        </PMPanel>
        <PMPanel title="Most requested software">
          <Bars rows={count(sod, (o) => o.title)} />
        </PMPanel>
        <PMPanel title="Most requested categories">
          <Bars rows={count(items, (o) => o.category)} />
        </PMPanel>
        <PMPanel title="Most requested features">
          <Bars
            rows={count(items, (o) =>
              String(o.details["features"] ?? "")
                .split(/\n|,/)
                .map((f) => f.trim().toLowerCase())
                .filter(Boolean),
            )}
          />
        </PMPanel>
        <PMPanel title="Requests by country">
          <Bars rows={count(items, (o) => o.country)} />
        </PMPanel>
        <PMPanel title="Requests by month">
          <Bars
            rows={count(items, (o) => o.created_at.slice(0, 7)).sort((a, b) =>
              b[0].localeCompare(a[0]),
            )}
          />
        </PMPanel>
        <PMPanel title="Requests by type">
          <Bars rows={count(items, (o) => TYPE_LABEL[o.type])} />
        </PMPanel>
        <PMPanel title="Requests by status">
          <Bars rows={count(items, (o) => o.status.replace(/_/g, " "))} />
        </PMPanel>
      </div>
    </PMSection>
  );
}

export function RdSettings({ actor, setActor }: { actor: string; setActor: (v: string) => void }) {
  const [v, setV] = useState(actor);
  return (
    <PMSection
      title="Settings"
      description="Name recorded on every action in the activity timeline."
    >
      <PMPanel>
        <div className="flex max-w-md gap-2">
          <Input
            aria-label="Acting as"
            value={v}
            onChange={(e) => setV(e.target.value)}
            maxLength={80}
          />
          <button
            type="button"
            className="min-h-10 rounded-md bg-primary px-4 text-sm text-primary-foreground"
            onClick={() => setActor(v.trim() || "R&D Manager")}
          >
            Save
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Public request form:{" "}
          <a className="text-brand hover:underline" href="/rd-manager/start">
            /rd-manager/start
          </a>{" "}
          · Public status tracking:{" "}
          <a className="text-brand hover:underline" href="/rd-manager/track">
            /rd-manager/track
          </a>
        </p>
      </PMPanel>
    </PMSection>
  );
}
