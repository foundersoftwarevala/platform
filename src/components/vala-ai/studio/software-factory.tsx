import { useEffect, useRef, useState } from "react";
import {
  HardDrive,
  Palette,
  Search,
  Wrench,
  ShieldCheck,
  MessageSquare,
  Play,
  RotateCcw,
  Check,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { AiPlanAnalyzer } from "@/components/vala-ai/studio/ai-plan-analyzer";

type StageState = "wait" | "run" | "done" | "heal";
type Stage = {
  key: string;
  title: string;
  icon: typeof HardDrive;
  detail: string;
  logs: string[];
  heals?: string;
};

const STAGES: Stage[] = [
  {
    key: "pick",
    title: "Pick source",
    icon: HardDrive,
    detail: "Matching template from source library (2 TB)",
    logs: [
      "Scanned 14,382 projects",
      "Best match: ecommerce-starter (score 0.94)",
      "Cloned to factory sandbox",
    ],
  },
  {
    key: "understand",
    title: "Understand",
    icon: Search,
    detail: "Reading requirement + codebase map",
    logs: [
      "Detected stack: React · Node · Postgres",
      "Found 212 screens, 38 brand tokens",
      "Requirement parsed into 6 tasks",
    ],
  },
  {
    key: "brand",
    title: "Apply branding",
    icon: Palette,
    detail: "Logo, colours, fonts, copy",
    logs: [
      "Primary colour → requested",
      "Logo replaced in 14 places",
      "App name updated across 61 files",
    ],
  },
  {
    key: "check",
    title: "Self-check",
    icon: ShieldCheck,
    detail: "Build, tests, missing pieces",
    logs: ["Build OK", "1,104 / 1,112 tests pass", "Missing: payment keys, contact page"],
    heals: "8 tests failed · 2 missing pieces",
  },
  {
    key: "heal",
    title: "Self-heal",
    icon: Wrench,
    detail: "Fixing what broke automatically",
    logs: [
      "Fixed contrast on new colours (6 tests)",
      "Rebuilt broken image paths (2 tests)",
      "Created contact page",
      "Payment keys → asked user",
    ],
  },
  {
    key: "reply",
    title: "Reply to user",
    icon: MessageSquare,
    detail: "Summary + what's still needed",
    logs: ["Report sent"],
  },
];

const SAMPLE =
  "Mujhe ek online kapde ki dukaan chahiye. Naam 'Rangrez', colour gehra hara aur sona, logo upload kiya hai. WhatsApp order button bhi ho.";

export function SoftwareFactory() {
  const [req, setReq] = useState(SAMPLE);
  const [states, setStates] = useState<StageState[]>(STAGES.map(() => "wait"));
  const [shown, setShown] = useState<number[]>(STAGES.map(() => 0));
  const [running, setRunning] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = states[states.length - 1] === "done";

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setStates(STAGES.map(() => "wait"));
    setShown(STAGES.map(() => 0));
    setRunning(false);
  };

  const start = () => {
    reset();
    setRunning(true);
    let t = 200;
    STAGES.forEach((s, i) => {
      timers.current.push(
        setTimeout(() => setStates((p) => p.map((v, j) => (j === i ? "run" : v))), t),
      );
      s.logs.forEach((_, k) => {
        t += 550;
        timers.current.push(
          setTimeout(() => setShown((p) => p.map((v, j) => (j === i ? k + 1 : v))), t),
        );
      });
      t += 300;
      timers.current.push(
        setTimeout(
          () => setStates((p) => p.map((v, j) => (j === i ? (s.heals ? "heal" : "done") : v))),
          t,
        ),
      );
    });
    timers.current.push(setTimeout(() => setRunning(false), t));
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-widest text-studio-dim">
            Software factory · self-healing
          </p>
          <h1 className="font-studio-display text-[30px] uppercase leading-none tracking-tight">
            Requirement in. Finished app out.
          </h1>
          <p className="mt-1 text-sm text-studio-dim">
            User sirf requirement likhe — factory code uthaati hai, branding badalti hai, khud check
            aur theek karti hai, phir jawab deti hai.
          </p>
        </div>

        <AiPlanAnalyzer />

        <div className="rounded-md border border-studio-line bg-studio-panel p-4">
          <p className="mb-3 text-xs text-studio-dim">
            Source design simulation only. The stages and example logs below do not scan, build,
            test or deliver software. Use Projects and the execution pipeline for real work.
          </p>
          <label htmlFor="req" className="text-xs uppercase tracking-wider text-studio-dim">
            Requirement
          </label>
          <textarea
            id="req"
            value={req}
            onChange={(e) => setReq(e.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded border border-studio-line bg-background p-3 text-sm outline-none focus:border-primary"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={start}
              disabled={running || !req.trim()}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}{" "}
              {running ? "Factory running" : "Start factory"}
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded border border-studio-line px-3 py-2 text-sm text-studio-dim hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
            <span className="ml-auto font-mono text-[11px] text-studio-faint">
              demo run · sample data
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {STAGES.map((s, i) => {
            const st = states[i];
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`rounded-md border bg-studio-panel p-4 transition-colors ${st === "run" ? "border-primary" : "border-studio-line"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-studio-faint">0{i + 1}</span>
                  <Icon className="h-4 w-4 text-studio-dim" />
                  <span className="text-sm font-medium">{s.title}</span>
                  <span className="ml-auto">
                    {st === "run" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    {st === "done" && <Check className="h-4 w-4 text-studio-ok" />}
                    {st === "heal" && <AlertTriangle className="h-4 w-4 text-primary" />}
                  </span>
                </div>
                <p className="mt-1 text-xs text-studio-dim">{s.detail}</p>
                <ul className="mt-3 min-h-[60px] space-y-1 font-mono text-[11px]">
                  {s.logs.slice(0, shown[i]).map((l) => (
                    <li key={l} className="text-studio-dim">
                      <span className="text-studio-faint">›</span> {l}
                    </li>
                  ))}
                </ul>
                {st === "heal" && (
                  <p className="mt-2 text-[11px] text-primary">{s.heals} → handed to self-heal</p>
                )}
              </div>
            );
          })}
        </div>

        {finished && (
          <div className="rounded-md border border-studio-ok/40 bg-studio-panel p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-studio-ok" /> Factory reply
            </div>
            <div className="mt-2 space-y-1 text-sm text-studio-dim">
              <p>
                Aapki dukaan taiyaar hai — naya naam, hara-sona colour aur aapka logo poore app mein
                lag gaya hai.
              </p>
              <p>
                Khud check karte waqt 8 cheezein tooti thi, sab theek kar di. Contact page bhi jod
                diya.
              </p>
              <p className="text-foreground">
                Aapse chahiye: payment ke liye apni payment keys, aur WhatsApp number.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
