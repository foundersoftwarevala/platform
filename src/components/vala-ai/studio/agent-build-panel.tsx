import { useState } from "react";
import { toast } from "sonner";
import { Bot, Link2, Loader2, Play } from "lucide-react";
import {
  getBuildLink,
  progressOf,
  startAgentBuild,
  useAgentBuild,
} from "@/lib/vala-ai/studio/agent-store";
import { CodeRunner } from "@/components/vala-ai/studio/code-runner";

const dot = {
  pending: "border border-studio-line text-studio-faint",
  running: "animate-pulse bg-accent/20 text-accent",
  done: "bg-studio-ok/15 text-studio-ok",
  failed: "bg-studio-fail/15 text-studio-fail",
} as const;

export function AgentBuildPanel() {
  const b = useAgentBuild();
  const [req, setReq] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const busy = b.phase === "planning" || b.phase === "building";
  const p = progressOf(b);
  const link = getBuildLink();
  const [copied, setCopied] = useState(false);
  const files = b.steps.filter((s) => s.code).map((s) => ({ file: s.file, code: s.code! }));

  return (
    <div className="mb-6 rounded-lg border border-accent/40 bg-studio-panel p-4">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-accent" />
        <span className="font-studio-display text-[14px] uppercase tracking-tight">
          Live AI agent build
        </span>
        {b.phase !== "idle" && (
          <span className="ml-auto font-mono text-[10px] text-studio-faint">
            {b.project || "planning"} · {p.done}/{p.total} · {p.pct}%
          </span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          aria-label="What should the agent build?"
          value={req}
          onChange={(e) => setReq(e.target.value)}
          placeholder="Kya banana hai? jaise: chhoti todo app with dark mode"
          className="h-9 flex-1 rounded-md border border-studio-line bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          onClick={() => startAgentBuild(req)}
          disabled={busy || !req.trim()}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {busy ? "Building…" : "Run agent"}
        </button>
      </div>
      {b.phase !== "idle" && (
        <>
          <div className="mt-3 h-1 overflow-hidden rounded bg-studio-raise">
            <div
              className="h-full bg-accent transition-[width]"
              style={{ width: `${b.phase === "planning" ? 4 : p.pct}%` }}
            />
          </div>
          {b.summary && <p className="mt-3 text-[13px] text-studio-dim">{b.summary}</p>}
          <div className="mt-3 space-y-2">
            {b.steps.map((s, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  disabled={!s.code}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[11px] ${dot[s.status]}`}
                  >
                    {s.status === "done" ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className={s.status === "pending" ? "text-studio-dim" : ""}>
                      {s.title}
                    </span>
                    <span className="block font-mono text-[10px] text-studio-faint">
                      {s.file} · {s.status}
                      {s.note ? ` · ${s.note}` : ""}
                    </span>
                  </span>
                </button>
                {open === i && s.code && (
                  <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-studio-line bg-background p-3 font-mono text-[11px] leading-relaxed">
                    {s.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
          {b.error && <p className="mt-3 text-sm text-studio-fail">{b.error}</p>}
          {link && (
            <button
              onClick={() => {
                void navigator.clipboard.writeText(link).then(
                  () => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  },
                  (error: unknown) => {
                    console.error("Vala build link could not be copied", error);
                    toast.error("Build link could not be copied.");
                  },
                );
              }}
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline"
            >
              <Link2 className="size-3.5" />
              {copied ? "Link copied" : "Copy build link (open on another device)"}
            </button>
          )}
          {b.phase === "done" && <CodeRunner files={files} />}
        </>
      )}
    </div>
  );
}
