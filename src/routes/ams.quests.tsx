import { useSyncExternalStore, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus, Trash2, CheckCircle2, Lock, ChevronRight, Sparkles, Swords, Crown, Calendar, TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/ams/shared/PageHeader";
import { EmptyState } from "@/components/ams/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { DEPARTMENTS } from "@/lib/ams/types";
import {
  QUEST_MODES, type QuestChain, type QuestMode, type QuestStage,
} from "@/lib/ams/missions.types";
import {
  listQuests, createQuest, deleteQuest, subscribeMissions,
  upsertStage, removeStage, completeStage, listMissions,
} from "@/lib/ams/missions.api";

export const Route = createFileRoute("/ams/quests")({
  head: () => ({
    meta: [
      { title: "Quests — AMS" },
      { name: "description", content: "Multi-stage quest chains — story mode, boss missions, elite challenges, season passes and XP journeys — with ordering and dependencies." },
      { property: "og:title", content: "Quests — AMS" },
      { property: "og:description", content: "Multi-stage quest chains — story mode, boss missions, elite challenges, season passes and XP journeys — with ordering and dependencies." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: QuestsPage,
});

const MODE_ICON: Record<QuestMode, React.ReactNode> = {
  "story":       <Sparkles className="h-3.5 w-3.5" />,
  "boss":        <Swords className="h-3.5 w-3.5" />,
  "elite":       <Crown className="h-3.5 w-3.5" />,
  "season-pass": <Calendar className="h-3.5 w-3.5" />,
  "xp-journey":  <TrendingUp className="h-3.5 w-3.5" />,
};

function useQuests() {
  return useSyncExternalStore(
    (cb) => subscribeMissions(cb),
    () => listQuests(),
    () => [] as QuestChain[],
  );
}

function QuestsPage() {
  const quests = useQuests();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const selected = quests.find((q) => q.id === selectedId) ?? quests[0] ?? null;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        kicker="quest chain editor"
        title="Quests"
        description="Multi-stage quest chains — story mode, boss missions, elite challenges, season passes and XP journeys — with ordering and dependencies."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 bg-gradient-to-r from-trophy to-legendary text-background hover:opacity-90">
                <Plus className="h-4 w-4" /> New quest chain
              </Button>
            </DialogTrigger>
            <NewQuestDialog onClose={() => setOpen(false)} />
          </Dialog>
        }
      />

      {quests.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No quest chains yet"
          description="Design your first quest — chain missions into a story arc, escalate through elite tiers, or ladder players through an XP journey."
          action={<Button onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-4 w-4" /> New quest chain</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-1">Chains · {quests.length}</div>
            {quests.map((q) => {
              const isActive = selected?.id === q.id;
              const mode = QUEST_MODES.find((m) => m.value === q.mode)!;
              return (
                <button
                  key={q.id}
                  onClick={() => setSelectedId(q.id)}
                  className={`w-full text-left surface-card p-3 transition ${isActive ? "ring-1 ring-legendary/60" : "hover:bg-card/60"}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest" style={{ color: mode.hue }}>
                    {MODE_ICON[q.mode]} {mode.label}
                  </div>
                  <div className="font-semibold mt-1 truncate">{q.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {q.stages.length} stage{q.stages.length !== 1 ? "s" : ""}
                    {q.season ? ` · ${q.season}` : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {selected && <QuestEditor quest={selected} />}
        </div>
      )}
    </div>
  );
}

function QuestEditor({ quest }: { quest: QuestChain }) {
  const [stageOpen, setStageOpen] = useState(false);
  const mode = QUEST_MODES.find((m) => m.value === quest.mode)!;

  return (
    <div className="space-y-4">
      <div className="surface-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest" style={{ color: mode.hue }}>
              {MODE_ICON[quest.mode]} {mode.label} {quest.department && `· ${quest.department}`}
            </div>
            <h2 className="text-xl font-bold tracking-tight mt-1">{quest.name}</h2>
            {quest.description && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{quest.description}</p>}
            {quest.season && <Badge variant="outline" className="mt-2 bg-amber-500/10 text-amber-300 border-amber-500/30">{quest.season}</Badge>}
          </div>
          <Button variant="ghost" size="sm" className="text-rose-400 gap-1" onClick={() => { deleteQuest(quest.id); toast("Quest deleted"); }}>
            <Trash2 className="h-3.5 w-3.5" /> Delete chain
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
          <RewardPill label="Finale XP" value={quest.finaleRewards.xp} />
          <RewardPill label="Finale Coins" value={quest.finaleRewards.coins} />
          <RewardPill label="Finale Tokens" value={quest.finaleRewards.tokens} />
          <RewardPill label="Finale Awards" value={quest.finaleRewards.awardIds.length} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Stages</h3>
        <Dialog open={stageOpen} onOpenChange={setStageOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add stage</Button>
          </DialogTrigger>
          <StageDialog quest={quest} onClose={() => setStageOpen(false)} />
        </Dialog>
      </div>

      {quest.stages.length === 0 ? (
        <div className="surface-card p-6 text-center text-sm text-muted-foreground">
          No stages yet. Add stages in order — each can depend on prior stages to gate progression.
        </div>
      ) : (
        <ol className="space-y-2">
          {quest.stages.map((s, i) => (
            <StageRow
              key={s.id}
              quest={quest}
              stage={s}
              prevStage={quest.stages[i - 1]}
              onComplete={() => {
                completeStage(quest.id, s.id);
                toast.success(`Stage "${s.title}" completed — rewards granted`);
              }}
              onDelete={() => { removeStage(quest.id, s.id); toast("Stage removed"); }}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

function StageRow({ quest, stage, prevStage, onComplete, onDelete }: {
  quest: QuestChain; stage: QuestStage; prevStage?: QuestStage;
  onComplete: () => void; onDelete: () => void;
}) {
  const locked = stage.status === "locked";
  const done = stage.status === "completed";
  return (
    <li className={`surface-card p-4 flex items-start gap-3 ${locked ? "opacity-60" : ""}`}>
      <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
        <div className={`w-8 h-8 rounded-full grid place-items-center text-xs font-bold ${
          done ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
          : locked ? "bg-muted text-muted-foreground border border-border"
          : "bg-legendary/20 text-legendary border border-legendary/40"
        }`}>
          {done ? <CheckCircle2 className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : stage.order}
        </div>
        {prevStage && <ChevronRight className="h-3 w-3 text-muted-foreground rotate-90" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold">{stage.title}</div>
          <Badge variant="outline" className="text-[10px]">{stage.status}</Badge>
        </div>
        {stage.description && <div className="text-xs text-muted-foreground mt-1">{stage.description}</div>}

        <div className="flex flex-wrap gap-1.5 text-[11px] mt-2">
          {stage.missionIds.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
              {stage.missionIds.length} mission{stage.missionIds.length > 1 ? "s" : ""}
            </span>
          )}
          {stage.dependsOn.length > 0 && (
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              depends on {stage.dependsOn.length}
            </span>
          )}
          {stage.rewards.xp > 0 && <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">+{stage.rewards.xp} XP</span>}
          {stage.rewards.coins > 0 && <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-300 border border-yellow-500/30">+{stage.rewards.coins} coins</span>}
          {stage.rewards.tokens > 0 && <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30">+{stage.rewards.tokens} tokens</span>}
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        {!done && !locked && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-emerald-400" onClick={onComplete}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Complete
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 text-rose-400" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
}

function RewardPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function NewQuestDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<QuestMode>("story");
  const [season, setSeason] = useState("");
  const [department, setDepartment] = useState("");
  const [xp, setXp] = useState(500);
  const [coins, setCoins] = useState(100);
  const [tokens, setTokens] = useState(1);

  function submit() {
    if (!name.trim()) { toast.error("Name required"); return; }
    createQuest({
      name, description, mode,
      season: season || undefined,
      department: department ? (department as QuestChain["department"]) : undefined,
      finaleRewards: { xp, coins, tokens, awardIds: [] },
    });
    toast.success(`Quest chain "${name}" created`);
    onClose();
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>New quest chain</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="The Founder's Ascent" /></Field>
        <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as QuestMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{QUEST_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Season (optional)"><Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="Season 3 — Winter" /></Field>
          <Field label="Department">
            <Select value={department || "none"} onValueChange={(v) => setDepartment(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {DEPARTMENTS.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Finale rewards</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="XP"><Input type="number" value={xp} onChange={(e) => setXp(+e.target.value || 0)} /></Field>
            <Field label="Coins"><Input type="number" value={coins} onChange={(e) => setCoins(+e.target.value || 0)} /></Field>
            <Field label="Tokens"><Input type="number" value={tokens} onChange={(e) => setTokens(+e.target.value || 0)} /></Field>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} className="bg-gradient-to-r from-trophy to-legendary text-background">Create chain</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function StageDialog({ quest, onClose }: { quest: QuestChain; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [order, setOrder] = useState(quest.stages.length + 1);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [missionIds, setMissionIds] = useState<string[]>([]);
  const [xp, setXp] = useState(100);
  const [coins, setCoins] = useState(25);
  const [tokens, setTokens] = useState(0);
  const missions = useMemo(() => listMissions(), []);

  function submit() {
    if (!title.trim()) { toast.error("Title required"); return; }
    upsertStage(quest.id, {
      title, description, order, dependsOn, missionIds,
      rewards: { xp, coins, tokens, awardIds: [] },
    });
    toast.success(`Stage "${title}" added`);
    onClose();
  }

  function toggle<T>(arr: T[], v: T, setter: (a: T[]) => void) {
    setter(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  }

  return (
    <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add stage</DialogTitle></DialogHeader>
      <div className="grid gap-4 py-2">
        <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 1 — Awakening" /></Field>
        <Field label="Description"><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Order"><Input type="number" value={order} onChange={(e) => setOrder(+e.target.value || 1)} /></Field>

        {quest.stages.length > 0 && (
          <Field label="Depends on (prior stages)">
            <div className="flex flex-wrap gap-1.5">
              {quest.stages.map((s) => (
                <button
                  key={s.id} type="button"
                  onClick={() => toggle(dependsOn, s.id, setDependsOn)}
                  className={`text-xs px-2 py-1 rounded border transition ${
                    dependsOn.includes(s.id)
                      ? "bg-legendary/20 border-legendary/50 text-legendary"
                      : "border-border bg-card/40 text-muted-foreground"
                  }`}
                >
                  #{s.order} {s.title}
                </button>
              ))}
            </div>
          </Field>
        )}

        {missions.length > 0 && (
          <Field label="Missions in this stage">
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
              {missions.map((m) => (
                <button
                  key={m.id} type="button"
                  onClick={() => toggle(missionIds, m.id, setMissionIds)}
                  className={`text-xs px-2 py-1 rounded border transition ${
                    missionIds.includes(m.id)
                      ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                      : "border-border bg-card/40 text-muted-foreground"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="rounded-md border border-border p-3 space-y-3">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stage rewards</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="XP"><Input type="number" value={xp} onChange={(e) => setXp(+e.target.value || 0)} /></Field>
            <Field label="Coins"><Input type="number" value={coins} onChange={(e) => setCoins(+e.target.value || 0)} /></Field>
            <Field label="Tokens"><Input type="number" value={tokens} onChange={(e) => setTokens(+e.target.value || 0)} /></Field>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} className="bg-gradient-to-r from-trophy to-legendary text-background">Add stage</Button>
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
