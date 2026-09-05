import { useSyncExternalStore, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, Play, Pause, CheckCircle2, EyeOff, Users, Calendar, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/lib/ams/types";
import {
  MISSION_TYPES, type Mission, type MissionStatus, type MissionType,
} from "@/lib/ams/missions.types";
import {
  createMission, deleteMission, setMissionStatus,
  progressMission, completeMission, subscribeMissions,
  missionsSnapshot, missionsServerSnapshot,
} from "@/lib/ams/missions.api";

export const Route = createFileRoute("/ams/missions")({
  head: () => ({
    meta: [
      { title: "Missions — AMS" },
      { name: "description", content: "Daily, weekly, monthly, yearly, department, hidden and community missions — each with rules, activation windows and reward grants." },
      { property: "og:title", content: "Missions — AMS" },
      { property: "og:description", content: "Daily, weekly, monthly, yearly, department, hidden and community missions — each with rules, activation windows and reward grants." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MissionsPage,
});

function useMissions() {
  return useSyncExternalStore(subscribeMissions, missionsSnapshot, missionsServerSnapshot);
}

const STATUS_META: Record<MissionStatus, { label: string; className: string }> = {
  draft:      { label: "Draft",      className: "bg-muted text-muted-foreground" },
  scheduled:  { label: "Scheduled",  className: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  active:     { label: "Active",     className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  paused:     { label: "Paused",     className: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  completed:  { label: "Completed",  className: "bg-legendary/20 text-legendary border-legendary/40" },
  expired:    { label: "Expired",    className: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  archived:   { label: "Archived",   className: "bg-muted text-muted-foreground" },
};

function MissionsPage() {
  const missions = useMissions();
  const [typeFilter, setTypeFilter] = useState<MissionType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MissionStatus | "all">("all");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => missions.filter((m) => {
    if (typeFilter !== "all" && m.type !== typeFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    return true;
  }), [missions, typeFilter, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: missions.length };
    for (const t of MISSION_TYPES) c[t.value] = missions.filter((m) => m.type === t.value).length;
    return c;
  }, [missions]);

  return (
    <div className="max-w-[1500px] mx-auto space-y-6">
      <PageHeader
        kicker="mission engine"
        title="Missions"
        description="Daily, weekly, monthly, yearly, department, hidden and community missions — each with rules, activation windows and reward grants."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90">
                <Plus className="h-4 w-4" /> New mission
              </Button>
            </DialogTrigger>
            <NewMissionDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      {/* Type strip */}
      <div className="flex flex-wrap gap-2">
        <TypeChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")} label={`All · ${counts.all}`} />
        {MISSION_TYPES.map((t) => (
          <TypeChip
            key={t.value}
            active={typeFilter === t.value}
            onClick={() => setTypeFilter(t.value)}
            label={`${t.label} · ${counts[t.value] ?? 0}`}
            hint={t.hint}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-xs text-muted-foreground">Status</Label>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MissionStatus | "all")}>
          <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No missions yet"
          description="Create your first mission — daily logins, weekly quotas, seasonal campaigns, hidden easter eggs, or a community-wide push."
          action={<Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New mission</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => <MissionCard key={m.id} m={m} />)}
        </div>
      )}
    </div>
  );
}

function TypeChip({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={`text-xs px-3 py-1.5 rounded-md border transition ${
        active
          ? "bg-legendary/20 border-legendary/50 text-legendary"
          : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function MissionCard({ m }: { m: Mission }) {
  const pct = m.progress.target > 0 ? Math.round((m.progress.current / m.progress.target) * 100) : 0;
  const meta = STATUS_META[m.status];
  const typeIcon = m.hidden ? <EyeOff className="h-3.5 w-3.5" />
    : m.type === "community" ? <Users className="h-3.5 w-3.5" />
    : <Calendar className="h-3.5 w-3.5" />;

  return (
    <div className="surface-card p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            {typeIcon} {m.type}{m.department ? ` · ${m.department}` : ""}
          </div>
          <div className="font-semibold mt-1">{m.name}</div>
          {m.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</div>}
        </div>
        <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
      </div>

      <div>
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Progress</span><span>{m.progress.current} / {m.progress.target}</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {m.rewards.xp > 0 && <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">+{m.rewards.xp} XP</span>}
        {m.rewards.coins > 0 && <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">+{m.rewards.coins} coins</span>}
        {m.rewards.tokens > 0 && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">+{m.rewards.tokens} tokens</span>}
        {m.rewards.awardIds.length > 0 && <span className="px-2 py-0.5 rounded bg-legendary/10 text-legendary border border-legendary/30">{m.rewards.awardIds.length} award{m.rewards.awardIds.length > 1 ? "s" : ""}</span>}
      </div>

      <div className="flex gap-1.5 pt-2 border-t border-border">
        {m.status !== "active" && m.status !== "completed" && (
          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => { setMissionStatus(m.id, "active"); toast.success("Mission activated"); }}>
            <Play className="h-3.5 w-3.5" /> Activate
          </Button>
        )}
        {m.status === "active" && (
          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => { setMissionStatus(m.id, "paused"); toast("Mission paused"); }}>
            <Pause className="h-3.5 w-3.5" /> Pause
          </Button>
        )}
        {m.status !== "completed" && (
          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => {
            const p = progressMission(m.id, 1);
            if (p.status === "completed") toast.success(`Completed! +${p.rewards.xp} XP granted`);
          }}>
            +1 progress
          </Button>
        )}
        {m.status !== "completed" && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-emerald-400" onClick={() => {
            completeMission(m.id);
            toast.success(`"${m.name}" completed — rewards granted`);
          }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-rose-400 ml-auto" onClick={() => { deleteMission(m.id); toast("Mission deleted"); }}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function NewMissionDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<MissionType>("daily");
  const [department, setDepartment] = useState<string>("");
  const [hidden, setHidden] = useState(false);
  const [metric, setMetric] = useState("actions.count");
  const [target, setTarget] = useState(1);
  const [xp, setXp] = useState(50);
  const [coins, setCoins] = useState(10);
  const [tokens, setTokens] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [repeatable, setRepeatable] = useState(false);

  function submit() {
    if (!name.trim()) { toast.error("Name required"); return; }
    createMission({
      name, description, type,
      department: department ? (department as Mission["department"]) : undefined,
      hidden: hidden || type === "hidden",
      rules: [{ id: crypto.randomUUID(), metric, operator: ">=", target }],
      rewards: { xp, coins, tokens, awardIds: [] },
      activation: {
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        repeatable: repeatable || ["daily", "weekly", "monthly"].includes(type),
      },
      status: startsAt ? "scheduled" : "active",
    });
    toast.success(`Mission "${name}" created`);
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New mission</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily login streak" /></Field>
        <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the player must accomplish…" /></Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as MissionType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MISSION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Department (optional)">
            <Select value={department || "none"} onValueChange={(v) => setDepartment(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Hidden">
            <div className="flex items-center h-10"><Switch checked={hidden} onCheckedChange={setHidden} /></div>
          </Field>
        </div>

        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rule</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Metric"><Input value={metric} onChange={(e) => setMetric(e.target.value)} placeholder="sales.count" /></Field>
            <Field label="Target"><Input type="number" value={target} onChange={(e) => setTarget(+e.target.value || 1)} /></Field>
          </div>
        </div>

        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Rewards</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="XP"><Input type="number" value={xp} onChange={(e) => setXp(+e.target.value || 0)} /></Field>
            <Field label="Coins"><Input type="number" value={coins} onChange={(e) => setCoins(+e.target.value || 0)} /></Field>
            <Field label="Tokens"><Input type="number" value={tokens} onChange={(e) => setTokens(+e.target.value || 0)} /></Field>
          </div>
        </div>

        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activation window</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts at"><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
            <Field label="Ends at"><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={repeatable} onCheckedChange={setRepeatable} id="rep" />
            <Label htmlFor="rep" className="text-xs">Repeatable</Label>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} className="bg-gradient-to-r from-trophy to-legendary text-background">Create mission</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
