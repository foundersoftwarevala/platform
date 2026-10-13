import { toast } from "sonner";
import { useOperator } from "@/components/vala-ai/session";
import { useEffect, useSyncExternalStore } from "react";
import { buildStepFn, planBuildFn } from "@/lib/vala-ai/studio/ai/agent.functions";
import { loadBuildFn, saveBuildFn } from "@/lib/vala-ai/studio/agent-cloud.functions";

export type StepStatus = "pending" | "running" | "done" | "failed";
export type AgentStep = {
  title: string;
  file: string;
  goal: string;
  status: StepStatus;
  code?: string;
  note?: string;
};
export type AgentLog = { t: string; msg: string; tone?: "ok" | "fail" | "run" | undefined };
export type AgentBuild = {
  requirement: string;
  project: string;
  summary: string;
  phase: "idle" | "planning" | "building" | "done" | "failed";
  steps: AgentStep[];
  log: AgentLog[];
  error?: string;
  runId?: string | undefined;
  startedAt?: number;
  updatedAt?: number;
};

const empty: AgentBuild = {
  requirement: "",
  project: "",
  summary: "",
  phase: "idle",
  steps: [],
  log: [],
};
let KEY = "";
let ID_KEY = "";
let operatorId: string | null = null;
let generation = 0;
let mounted = 0;
const load = (): AgentBuild => {
  if (typeof window === "undefined") return empty;
  try {
    const v = window.localStorage.getItem(KEY);
    return v ? { ...empty, ...JSON.parse(v) } : empty;
  } catch (error) {
    console.error("Vala build cache is invalid", error);
    toast.error("Saved build could not be restored.");
    return empty;
  }
};
let state: AgentBuild = empty;
const subs = new Set<() => void>();

// A reload aborts in-flight AI calls; ignore those so the saved build stays resumable.
let unloading = false;
if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    unloading = true;
  });
if (typeof window !== "undefined")
  window.addEventListener("pageshow", () => {
    unloading = false;
  });
let cloudId: string | null = null;
export const getBuildLink = () =>
  cloudId && typeof window !== "undefined"
    ? `${window.location.origin}/vala-ai?build=${cloudId}`
    : null;

let cloudTimer: ReturnType<typeof setTimeout> | null = null;
let cloudSaving: Promise<void> = Promise.resolve();
const pushCloud = () => {
  if (cloudTimer) clearTimeout(cloudTimer);
  const scope = generation;
  cloudTimer = setTimeout(() => {
    if (scope !== generation || !operatorId) return;
    const snapshot = state;
    const id = cloudId;
    cloudSaving = cloudSaving.then(async () => {
      if (scope !== generation || !operatorId) return;
      try {
        const r = await saveBuildFn({
          data: { id: id ?? undefined, data: JSON.stringify(snapshot) },
        });
        if (scope !== generation) return;
        if (r.id !== cloudId) {
          cloudId = r.id;
          window.localStorage.setItem(ID_KEY, r.id);
          state = { ...state };
          subs.forEach((f) => f());
        }
      } catch (error) {
        if (scope !== generation) return;
        console.error("Vala build persistence failed", error);
        toast.error("Vala AI could not save or load this build.");
      }
    });
  }, 300);
};
const save = () => {
  if (unloading || !operatorId) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Vala build persistence failed", error);
    toast.error("Vala AI could not save or load this build.");
  }
  if (state.phase !== "idle") pushCloud();
};

/** Pull the cloud copy; adopt it when newer than the local one. */
async function pullCloud() {
  if (!cloudId || !operatorId) return;
  const scope = generation;
  try {
    const r = await loadBuildFn({ data: { id: cloudId } });
    if (scope !== generation) return;
    const remote = r ? (JSON.parse(r.json) as AgentBuild) : undefined;
    if (remote && (remote.updatedAt ?? 0) > (state.updatedAt ?? 0)) {
      state = { ...empty, ...remote };
      try {
        window.localStorage.setItem(KEY, JSON.stringify(state));
      } catch (error) {
        if (scope !== generation) return;
        console.error("Vala build persistence failed", error);
        toast.error("Vala AI could not save or load this build.");
      }
      subs.forEach((f) => f());
    }
  } catch (error) {
    console.error("Vala build persistence failed", error);
    toast.error("Vala AI could not save or load this build.");
  }
}
const set = (p: Partial<AgentBuild>) => {
  state = { ...state, ...p, updatedAt: Date.now() };
  save();
  subs.forEach((f) => f());
};
const log = (msg: string, tone?: AgentLog["tone"]) =>
  set({
    log: [
      {
        t: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        msg,
        tone,
      },
      ...state.log,
    ].slice(0, 30),
  });

let booted = false;
let pollTimer: ReturnType<typeof setInterval> | undefined;
async function boot() {
  if (booted) return;
  const scope = generation;
  booted = true;
  await pullCloud();
  if (scope !== generation) return;
  // If another device updated this build in the last 20s, it is still running there: follow it instead.
  const fresh = Date.now() - (state.updatedAt ?? 0) < 20_000;
  if (!fresh) await resumeAgentBuild();
  if (scope !== generation) return;
  pollTimer = setInterval(async () => {
    if (running || document.hidden) return;
    await pullCloud();
    if (
      (state.phase === "building" || state.phase === "planning") &&
      Date.now() - (state.updatedAt ?? 0) > 45_000
    )
      void resumeAgentBuild();
  }, 5000);
}

export function useAgentBuild() {
  const operator = useOperator();
  useEffect(() => {
    if (operatorId !== operator.id) {
      generation++;
      if (cloudTimer) clearTimeout(cloudTimer);
      if (pollTimer) clearInterval(pollTimer);
      running = false;
      booted = false;
      mounted = 0;
      operatorId = operator.id;
      KEY = `vala-studio-build:${operator.id}`;
      ID_KEY = `vala-studio-build-id:${operator.id}`;
      state = load();
      try {
        const fromUrl = new URLSearchParams(window.location.search).get("build");
        cloudId = fromUrl || window.localStorage.getItem(ID_KEY);
        if (fromUrl) window.localStorage.setItem(ID_KEY, fromUrl);
      } catch (error) {
        cloudId = null;
        console.error("Vala build cache could not be read", error);
        toast.error("Saved build could not be restored.");
      }
      subs.forEach((f) => f());
    }
    const scope = generation;
    mounted++;
    void boot();
    return () => {
      if (scope !== generation || --mounted > 0) return;
      generation++;
      if (cloudTimer) clearTimeout(cloudTimer);
      if (pollTimer) clearInterval(pollTimer);
      operatorId = null;
      running = false;
      booted = false;
      state = empty;
      cloudId = null;
      subs.forEach((f) => f());
    };
  }, [operator.id]);
  return useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
    () => empty,
  );
}

let running = false;
export async function startAgentBuild(requirement: string) {
  if (!operatorId) throw new Error("Control Panel operator session is required.");
  if (running) return;
  const scope = generation;
  running = true;
  cloudId = null;
  try {
    window.localStorage.removeItem(ID_KEY);
  } catch (error) {
    console.error("Vala build persistence failed", error);
    toast.error("Vala AI could not save or load this build.");
  }
  state = { ...empty, requirement, phase: "planning", startedAt: Date.now() };
  log("Architect agent: planning build…", "run");
  try {
    const { out: plan, runId } = await planBuildFn({ data: { requirement } });
    if (scope !== generation) return;
    const steps = plan.steps.slice(0, 8).map((s) => ({ ...s, status: "pending" as StepStatus }));
    set({ project: plan.project, summary: plan.summary, steps, phase: "building", runId });
    log(`Plan ready · ${steps.length} steps`, "ok");
    await runSteps(scope);
  } catch (e) {
    if (scope === generation) fail(e);
  } finally {
    if (scope === generation) running = false;
  }
}

const fail = (e: unknown) => {
  if (unloading) return;
  const msg = e instanceof Error ? e.message : "Build failed.";
  set({ phase: "failed", error: msg });
  log(msg, "fail");
};

/** Continue an interrupted build (e.g. after a page reload) from the first unfinished step. */
export async function resumeAgentBuild() {
  if (running || !operatorId || typeof window === "undefined") return;
  const scope = generation;
  if (state.phase === "planning") {
    const req = state.requirement;
    if (req) return startAgentBuild(req);
    return;
  }
  if (state.phase !== "building") return;
  running = true;
  log("Bache hue step se build wapas shuru", "run");
  try {
    await runSteps(scope);
  } catch (e) {
    if (scope === generation) fail(e);
  } finally {
    if (scope === generation) running = false;
  }
}

async function runSteps(scope: number) {
  const requirement = state.requirement;
  const runId = state.runId;
  const steps = state.steps;
  const planPayload = {
    project: state.project,
    summary: state.summary,
    steps: steps.map(({ title, file, goal }) => ({ title, file, goal })),
  };
  {
    for (let i = 0; i < steps.length; i++) {
      if (scope !== generation) return;
      if (state.steps[i]?.status === "done") continue;
      set({ steps: state.steps.map((s, j) => (j === i ? { ...s, status: "running" } : s)) });
      log(`Coding agent: ${steps[i]!.title}`, "run");
      try {
        const previous = state.steps
          .filter((s) => s.code)
          .map((s) => ({ file: s.file, code: s.code!.slice(0, 40000) }));
        const { out } = await buildStepFn({
          data: { requirement, plan: planPayload, index: i, previous, runId },
        });
        if (scope !== generation) return;
        set({
          steps: state.steps.map((s, j) =>
            j === i
              ? { ...s, status: "done", code: out.code, note: out.note, file: out.file || s.file }
              : s,
          ),
        });
        log(`${out.file || steps[i]!.file} written · ${out.code.split("\n").length} lines`, "ok");
      } catch (e) {
        if (scope !== generation) return;
        set({ steps: state.steps.map((s, j) => (j === i ? { ...s, status: "failed" } : s)) });
        throw e;
      }
    }
    set({ phase: "done" });
    log("Build complete", "ok");
  }
}

export function clearAgentBuild() {
  if (running) return;
  state = empty;
  cloudId = null;
  try {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(ID_KEY);
  } catch (error) {
    console.error("Vala build persistence failed", error);
    toast.error("Vala AI could not save or load this build.");
  }
  subs.forEach((f) => f());
}

export const progressOf = (b: AgentBuild) => {
  const done = b.steps.filter((s) => s.status === "done").length;
  return {
    done,
    total: b.steps.length,
    pct: b.steps.length ? Math.round((done / b.steps.length) * 100) : 0,
  };
};
