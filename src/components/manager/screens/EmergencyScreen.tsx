import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Clock,
  FileWarning,
  Lock,
  Play,
  Shield,
  Skull,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useInsertRecord, useManyRecords, useUpdateRecord, type Row } from "@/lib/manager-queries";
import {
  EmptyState,
  ErrorState,
  GlassCard,
  LoadingBlock,
  PageHeader,
  StatusBadge,
  when,
} from "@/components/manager/primitives";

function useScrollIntoFocus(view: string | undefined) {
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!view) return;
    const el = refs.current[view];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("ring-2", "ring-primary/60");
      const t = setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 2000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [view]);
  return refs;
}

const CONTROL_META: Record<
  string,
  { title: string; description: string; icon: React.ReactNode; tone: string; childId: string }
> = {
  kill_all: {
    title: "Kill All APIs",
    description: "Immediately disable every API service",
    icon: <Skull className="h-8 w-8" />,
    tone: "border-status-error/50",
    childId: "emg-kill-all",
  },
  kill_ai: {
    title: "Kill AI APIs Only",
    description: "Deactivate all AI models",
    icon: <Bot className="h-8 w-8" />,
    tone: "border-status-warning/50",
    childId: "emg-kill-ai",
  },
  lock_wallet: {
    title: "Lock Wallet",
    description: "Freeze all wallet transactions",
    icon: <Lock className="h-8 w-8" />,
    tone: "border-status-warning/50",
    childId: "emg-lock-wallet",
  },
};

export default function EmergencyScreen({ view }: { view?: string | undefined }) {
  const refs = useScrollIntoFocus(view);

  const many = useManyRecords([
    { table: "emergency_controls", orderBy: "key", ascending: true, limit: 50 },
    { table: "api_services", limit: 1000 },
    { table: "ai_models", limit: 1000 },
    { table: "wallets", limit: 500 },
    { table: "incidents", orderBy: "started_at", ascending: false, limit: 100 },
  ]);

  const rowsMany = many.data ?? [[], [], [], [], []];
  const controls: Row[] = rowsMany[0] ?? [];
  const services: Row[] = rowsMany[1] ?? [];
  const aiModels: Row[] = rowsMany[2] ?? [];
  const wallets: Row[] = rowsMany[3] ?? [];
  const incidents: Row[] = rowsMany[4] ?? [];
  const isLoading = many.isLoading;
  const error = many.error;

  const update = useUpdateRecord("Updated");
  const insert = useInsertRecord("Created");

  const controlByKey = useMemo(() => {
    const map = new Map<string, Row>();
    for (const c of controls) map.set(String(c["key"]), c);
    return map;
  }, [controls]);

  const anyEngaged = controls.some((c) => Boolean(c["engaged"]));

  const applyEffect = (key: string, engage: boolean) => {
    if (key === "kill_all") {
      for (const s of services) {
        update.mutate({ table: "api_services", id: String(s["id"]), values: { status: engage ? "disabled" : "active" } });
      }
    } else if (key === "kill_ai") {
      for (const m of aiModels) {
        update.mutate({ table: "ai_models", id: String(m["id"]), values: { status: engage ? "inactive" : "active" } });
      }
    } else if (key === "lock_wallet") {
      for (const w of wallets) {
        update.mutate({ table: "wallets", id: String(w["id"]), values: { status: engage ? "locked" : "active" } });
      }
    }
  };

  const engageControl = (key: string) => {
    const control = controlByKey.get(key);
    const meta = CONTROL_META[key];
    if (control) {
      update.mutate({
        table: "emergency_controls",
        id: String(control["id"]),
        values: { engaged: true, engaged_at: new Date().toISOString(), engaged_by: "manager-console" },
      });
    } else {
      insert.mutate({
        table: "emergency_controls",
        values: {
          key,
          label: meta?.title ?? key,
          scope: key,
          engaged: true,
          engaged_at: new Date().toISOString(),
          engaged_by: "manager-console",
          description: meta?.description ?? "",
        },
      });
    }
    applyEffect(key, true);
  };

  const resumeControl = (key: string) => {
    const control = controlByKey.get(key);
    if (control) {
      update.mutate({
        table: "emergency_controls",
        id: String(control["id"]),
        values: { engaged: false, engaged_at: null, engaged_by: null },
      });
    }
    applyEffect(key, false);
  };

  const resumeAll = () => {
    for (const key of Object.keys(CONTROL_META)) {
      if (controlByKey.get(key)?.["engaged"]) resumeControl(key);
    }
  };

  // Incident form
  const [incTitle, setIncTitle] = useState("");
  const [incSeverity, setIncSeverity] = useState("high");
  const [incServiceId, setIncServiceId] = useState<string>("");
  const [incImpact, setIncImpact] = useState("");

  const createIncident = () => {
    if (!incTitle.trim()) return;
    insert.mutate({
      table: "incidents",
      values: {
        title: incTitle.trim(),
        severity: incSeverity,
        service_id: incServiceId || null,
        impact: incImpact.trim() || null,
        status: "open",
        started_at: new Date().toISOString(),
      },
    });
    setIncTitle("");
    setIncImpact("");
    setIncServiceId("");
  };

  const resolveIncident = (incident: Row) => {
    update.mutate({
      table: "incidents",
      id: String(incident["id"]),
      values: { status: "resolved", resolved_at: new Date().toISOString() },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Emergency Controls" description="Critical system controls for emergencies" />
        <LoadingBlock rows={6} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Emergency Controls" description="Critical system controls for emergencies" />
        <ErrorState error={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Controls"
        description="Kill switches, wallet lock and incident response"
        actions={
          <Badge
            variant="outline"
            className={
              anyEngaged
                ? "border-status-error/40 text-status-error"
                : "border-status-success/40 text-status-success"
            }
          >
            <CheckCircle className="mr-1 h-3 w-3" />
            {anyEngaged ? "Controls Engaged" : "System Operational"}
          </Badge>
        }
      />

      <GlassCard>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-status-error" />
          <div>
            <p className="text-sm font-medium text-status-error">Warning: Emergency Controls</p>
            <p className="text-xs text-muted-foreground">
              These actions immediately affect live system operations. Use with extreme caution.
            </p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["kill_all", "kill_ai", "lock_wallet"] as const).map((key) => {
          const meta = CONTROL_META[key]!;
          const control = controlByKey.get(key);
          const engaged = Boolean(control?.["engaged"]);
          return (
            <div key={key} ref={(el) => { refs.current[meta.childId] = el; }} className="rounded-xl transition-all">
              <GlassCard className={`border-2 ${meta.tone}`}>
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-status-error/30 to-status-warning/20 p-3 text-foreground">
                    {meta.icon}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h3 className="text-lg font-bold text-foreground">{meta.title}</h3>
                      <StatusBadge value={engaged ? "engaged" : "normal"} />
                    </div>
                    <p className="mb-1 text-sm text-muted-foreground">{meta.description}</p>
                    {engaged && control?.["engaged_at"] ? (
                      <p className="mb-3 text-xs text-muted-foreground">
                        Engaged {when(control["engaged_at"] as string)} by {String(control["engaged_by"] ?? "—")}
                      </p>
                    ) : (
                      <div className="mb-3" />
                    )}
                    {engaged ? (
                      <Button className="w-full" variant="outline" onClick={() => resumeControl(key)}>
                        <Play className="mr-2 h-4 w-4" />
                        Resume {meta.title}
                      </Button>
                    ) : (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button className="w-full" variant="destructive">
                            <Zap className="mr-2 h-4 w-4" />
                            Execute {meta.title}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Confirm: {meta.title}</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will immediately apply "{meta.description}". This action affects live
                              services and can be reversed with Resume.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => engageControl(key)}>Confirm</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </GlassCard>
            </div>
          );
        })}

        <div ref={(el) => { refs.current["emg-resume"] = el; }} className="rounded-xl transition-all">
          <GlassCard className="border-2 border-status-success/50">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-gradient-to-br from-status-success/30 to-status-success/10 p-3 text-foreground">
                <Play className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="mb-1 text-lg font-bold text-foreground">Resume System</h3>
                <p className="mb-3 text-sm text-muted-foreground">
                  Restore all normal operations by reversing every engaged control.
                </p>
                <Button className="w-full" variant="outline" disabled={!anyEngaged} onClick={resumeAll}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume All
                </Button>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <div ref={(el) => { refs.current["emg-incident"] = el; }} className="rounded-xl transition-all">
        <GlassCard title="Incident Reporting" icon={<FileWarning className="h-4 w-4 text-status-warning" />}>
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Title</Label>
              <Input value={incTitle} onChange={(e) => setIncTitle(e.target.value)} placeholder="Cost spike detected" />
            </div>
            <div>
              <Label className="text-xs">Severity</Label>
              <Select value={incSeverity} onValueChange={setIncSeverity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Affected Service</Label>
              <Select value={incServiceId} onValueChange={setIncServiceId}>
                <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={String(s["id"])} value={String(s["id"])}>{String(s["name"])}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Impact</Label>
              <Textarea value={incImpact} onChange={(e) => setIncImpact(e.target.value)} placeholder="Describe the impact…" />
            </div>
            <div className="md:col-span-2">
              <Button onClick={createIncident} disabled={!incTitle.trim()}>
                <FileWarning className="mr-2 h-4 w-4" />
                File Incident Report
              </Button>
            </div>
          </div>

          {incidents.length === 0 ? (
            <EmptyState message="No incidents recorded" />
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {incidents.map((incident) => (
                <div
                  key={String(incident["id"])}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-status-warning/20 p-2">
                      <AlertTriangle className="h-4 w-4 text-status-warning" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{String(incident["title"])}</p>
                        <StatusBadge value={String(incident["status"] ?? "")} />
                        <StatusBadge value={String(incident["severity"] ?? "")} />
                      </div>
                      {incident["impact"] ? (
                        <p className="mt-1 text-xs text-muted-foreground">{String(incident["impact"])}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">Started {when(incident["started_at"] as string)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {String(incident["status"]).toLowerCase() !== "resolved" ? (
                      <Button size="sm" variant="outline" onClick={() => resolveIncident(incident)}>
                        <Shield className="mr-1 h-4 w-4" />
                        Resolve
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {when(incident["resolved_at"] as string)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
