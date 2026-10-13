import { ArrowRight } from "lucide-react";
import { progressOf, useAgentBuild } from "@/lib/vala-ai/studio/agent-store";

export function LiveAgentCard({ onOpen }: { onOpen: () => void }) {
  const b = useAgentBuild();
  if (b.phase === "idle") return null;
  const p = progressOf(b);
  const cur = b.steps.find((s) => s.status === "running");
  const tone =
    b.phase === "failed"
      ? "text-studio-fail"
      : b.phase === "done"
        ? "text-studio-ok"
        : "text-accent";
  return (
    <section className="rise rounded-lg border border-accent/40 bg-studio-panel p-4">
      <div className="flex items-center gap-2">
        <span
          className={`size-1.5 rounded-full ${b.phase === "failed" ? "bg-studio-fail" : b.phase === "done" ? "bg-studio-ok" : "animate-pulse bg-accent"}`}
        />
        <h2 className="font-mono text-[10px] uppercase tracking-[.2em] text-studio-faint">
          Live agent build
        </h2>
        <span className="font-studio-display text-[14px] uppercase tracking-tight">
          {b.project || "planning…"}
        </span>
        <span className={`ml-auto font-mono text-[11px] ${tone}`}>
          {b.phase} · {p.done}/{p.total} · {p.pct}%
        </span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded bg-studio-raise">
        <div className="h-full bg-accent transition-[width]" style={{ width: `${p.pct}%` }} />
      </div>
      <div className="mt-2 text-[12px] text-studio-dim">
        {cur
          ? `Now: ${cur.title} → ${cur.file}`
          : (b.error ?? (b.phase === "done" ? "All steps complete" : "Planning steps…"))}
      </div>
      <ul className="mt-2 space-y-0.5 font-mono text-[10px]">
        {b.log.slice(0, 4).map((l, i) => (
          <li
            key={i}
            className={
              l.tone === "fail"
                ? "text-studio-fail"
                : l.tone === "ok"
                  ? "text-studio-ok"
                  : "text-studio-faint"
            }
          >
            {l.t} · {l.msg}
          </li>
        ))}
      </ul>
      <button
        onClick={onOpen}
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-accent hover:underline"
      >
        Open in workspace <ArrowRight className="size-3.5" />
      </button>
    </section>
  );
}
