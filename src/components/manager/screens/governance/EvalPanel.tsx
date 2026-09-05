import { useMemo, useState } from "react";
import { AlertCircle, FlaskConical, Plus, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useInsertRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge, when } from "@/components/manager/primitives";

export function EvalPanel({ evaluations, models }: { evaluations: Row[]; models: Row[] }) {
  const insert = useInsertRecord("Evaluation recorded");
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState<string>("none");
  const [suite, setSuite] = useState("");
  const [metric, setMetric] = useState("accuracy");
  const [score, setScore] = useState(0);
  const [baseline, setBaseline] = useState(0);

  const modelById = useMemo(() => new Map(models.map((m) => [m["id"], m])), [models]);

  const avgScore = evaluations.length
    ? evaluations.reduce((s, e) => s + Number(e["score"] ?? 0), 0) / evaluations.length
    : 0;
  const passed = evaluations.filter((e) => e["status"] === "passed").length;

  const runEval = () => {
    if (!suite.trim()) return;
    insert.mutate({
      table: "model_evaluations",
      values: {
        model_id: modelId === "none" ? null : modelId,
        suite,
        metric,
        score,
        baseline,
        status: score >= baseline ? "passed" : "warning",
      },
    });
    setOpen(false);
    setSuite("");
    setScore(0);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Avg Score" value={avgScore.toFixed(1)} icon={<Target className="h-4 w-4" />} tone="green" />
        <StatCard label="Total Evaluations" value={evaluations.length} icon={<FlaskConical className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Passed" value={passed} icon={<Target className="h-4 w-4" />} tone="violet" />
        <StatCard label="Warnings" value={evaluations.length - passed} icon={<AlertCircle className="h-4 w-4" />} tone="amber" />
      </div>

      <GlassCard
        title="Benchmark Results"
        icon={<FlaskConical className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Run Benchmark
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Run Benchmark</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Model</Label>
                  <Select value={modelId} onValueChange={setModelId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m["id"] as string} value={m["id"] as string}>
                          {String(m["name"])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Suite</Label>
                  <Input value={suite} onChange={(e) => setSuite(e.target.value)} placeholder="MMLU" />
                </div>
                <div>
                  <Label>Metric</Label>
                  <Input value={metric} onChange={(e) => setMetric(e.target.value)} />
                </div>
                <div>
                  <Label>Score</Label>
                  <Input type="number" value={score} onChange={(e) => setScore(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Baseline</Label>
                  <Input type="number" value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={runEval}>Run</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {evaluations.length === 0 ? (
          <EmptyState message="No evaluations recorded yet" />
        ) : (
          <div className="space-y-2">
            {evaluations.map((e) => {
              const model = modelById.get(e["model_id"]) as Row | undefined;
              return (
                <div key={e["id"] as string} className="flex items-center justify-between rounded-lg border border-border/50 bg-secondary/20 p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{model ? String(model["name"]) : "Unknown model"}</p>
                    <p className="text-xs text-muted-foreground">{String(e["suite"])} · {when(e["evaluated_at"] as string)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <p className="font-medium text-status-success">{Number(e["score"] ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">{String(e["metric"])}</p>
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-status-info">{Number(e["baseline"] ?? 0)}</p>
                      <p className="text-[10px] text-muted-foreground">Baseline</p>
                    </div>
                    <StatusBadge value={String(e["status"])} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
