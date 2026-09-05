import { useMemo, useState } from "react";
import { Cpu, DollarSign, FlaskConical, Play, Plus, Square } from "lucide-react";

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
import { Progress } from "@/components/ui/progress";

import { useInsertRecord, useUpdateRecord, type Row } from "@/lib/manager-queries";
import { EmptyState, GlassCard, StatCard, StatusBadge, usd, when } from "@/components/manager/primitives";

export function FineTunePanel({ jobs }: { jobs: Row[] }) {
  const insert = useInsertRecord("Training job created");
  const update = useUpdateRecord("Job updated");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseModel, setBaseModel] = useState("");
  const [datasetName, setDatasetName] = useState("");
  const [datasetRows, setDatasetRows] = useState(1000);

  const totalCost = useMemo(() => jobs.reduce((s, j) => s + Number(j["cost_usd"] ?? 0), 0), [jobs]);
  const running = jobs.filter((j) => j["status"] === "running").length;

  const createJob = () => {
    if (!name.trim() || !baseModel.trim() || !datasetName.trim()) return;
    insert.mutate({
      table: "fine_tuning_jobs",
      values: {
        name,
        base_model: baseModel,
        dataset_name: datasetName,
        dataset_rows: datasetRows,
        status: "queued",
        progress: 0,
        cost_usd: 0,
      },
    });
    setOpen(false);
    setName("");
    setBaseModel("");
    setDatasetName("");
  };

  const stopJob = (job: Row) => {
    update.mutate({ table: "fine_tuning_jobs", id: job["id"] as string, values: { status: "stopped" } });
  };

  const startJob = (job: Row) => {
    update.mutate({
      table: "fine_tuning_jobs",
      id: job["id"] as string,
      values: { status: "running", started_at: new Date().toISOString() },
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total Jobs" value={jobs.length} icon={<FlaskConical className="h-4 w-4" />} tone="violet" />
        <StatCard label="Currently Training" value={running} icon={<Cpu className="h-4 w-4" />} tone="cyan" />
        <StatCard label="Total Cost" value={usd(totalCost)} icon={<DollarSign className="h-4 w-4" />} tone="green" />
        <StatCard
          label="Total Dataset Rows"
          value={jobs.reduce((s, j) => s + Number(j["dataset_rows"] ?? 0), 0).toLocaleString("en-US")}
          icon={<FlaskConical className="h-4 w-4" />}
          tone="amber"
        />
      </div>

      <GlassCard
        title="Fine-Tuning Jobs"
        icon={<FlaskConical className="h-4 w-4 text-primary" />}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New Training Job</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <Label>Base Model</Label>
                  <Input value={baseModel} onChange={(e) => setBaseModel(e.target.value)} placeholder="gpt-4" />
                </div>
                <div>
                  <Label>Dataset Name</Label>
                  <Input value={datasetName} onChange={(e) => setDatasetName(e.target.value)} />
                </div>
                <div>
                  <Label>Dataset Rows</Label>
                  <Input type="number" value={datasetRows} onChange={(e) => setDatasetRows(Number(e.target.value))} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createJob}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      >
        {jobs.length === 0 ? (
          <EmptyState message="No fine-tuning jobs yet" />
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job["id"] as string} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{String(job["name"])}</p>
                    <p className="text-xs text-muted-foreground">
                      Base: {String(job["base_model"])} · {String(job["dataset_name"])} ({Number(job["dataset_rows"] ?? 0).toLocaleString("en-US")} rows)
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-status-success">{usd(Number(job["cost_usd"] ?? 0))}</span>
                    <StatusBadge value={String(job["status"])} />
                    {job["status"] === "running" ? (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => stopJob(job)}>
                        <Square className="h-3.5 w-3.5" />
                      </Button>
                    ) : job["status"] === "queued" ? (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startJob(job)}>
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {job["status"] !== "queued" ? <Progress value={Number(job["progress"] ?? 0)} className="h-1.5" /> : null}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Started {when(job["started_at"] as string | null)} · Completed {when(job["completed_at"] as string | null)}
                </p>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
