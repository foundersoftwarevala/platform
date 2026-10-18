import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/rd-module/utils";

type Item = {
  id: string;
  public_request_id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
};
type Level = "alert" | "medium" | "normal";

const TONE: Record<
  Level,
  { var: string; text: string; label: string; Icon: typeof AlertTriangle }
> = {
  alert: { var: "var(--color-danger)", text: "text-danger", label: "Alert", Icon: AlertTriangle },
  medium: { var: "var(--color-warning)", text: "text-warning", label: "Medium", Icon: AlertCircle },
  normal: {
    var: "var(--color-success)",
    text: "text-success",
    label: "Normal",
    Icon: CheckCircle2,
  },
};

const levelOf = (p: string): Level =>
  p === "critical" || p === "high" ? "alert" : p === "medium" ? "medium" : "normal";
const RANK: Record<Level, number> = { alert: 0, medium: 1, normal: 2 };
const OPEN = ["NEW", "UNDER_REVIEW", "NEEDS_INFORMATION"];

export function RdAlertBanner({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const notes = useMemo(
    () =>
      items
        .filter((o) => OPEN.includes(o.status))
        .map((o) => ({ ...o, level: levelOf(o.priority) }))
        .sort((a, b) => RANK[a.level] - RANK[b.level] || b.created_at.localeCompare(a.created_at))
        .slice(0, 12),
    [items],
  );
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || notes.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % notes.length), 5000);
    return () => clearInterval(t);
  }, [paused, notes.length]);

  const cur = notes[i % Math.max(notes.length, 1)];
  const level: Level = cur?.level ?? "normal";
  const tone = TONE[level];
  const counts = { alert: 0, medium: 0, normal: 0 };
  notes.forEach((n) => counts[n.level]++);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="alert-banner mb-6 flex min-h-16 items-center gap-4 overflow-hidden rounded-2xl px-5 py-3 transition-colors duration-500"
      style={{ ["--tone" as string]: tone.var }}
    >
      <tone.Icon className={cn("h-6 w-6 shrink-0", tone.text)} aria-hidden="true" />
      <div key={cur?.id ?? "none"} className="animate-banner-in min-w-0 flex-1">
        {cur ? (
          <button type="button" onClick={() => onOpen(cur.id)} className="block w-full text-left">
            <span className={cn("mr-2 text-xs font-bold uppercase tracking-wider", tone.text)}>
              {tone.label}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{cur.public_request_id}</span>
            <p className="truncate text-sm font-medium text-foreground">{cur.title}</p>
          </button>
        ) : (
          <p className="text-sm font-medium text-foreground">
            Sab normal hai — koi open alert nahi.
          </p>
        )}
      </div>
      <div className="hidden items-center gap-2 text-xs sm:flex">
        <span className="rounded-full bg-danger/15 px-2 py-1 text-danger">{counts.alert}</span>
        <span className="rounded-full bg-warning/15 px-2 py-1 text-warning">{counts.medium}</span>
        <span className="rounded-full bg-success/15 px-2 py-1 text-success">{counts.normal}</span>
      </div>
      {notes.length > 1 && (
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setI((n) => (n - 1 + notes.length) % notes.length)}
            className="rounded-lg p-1.5 hover:bg-surface-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => setI((n) => (n + 1) % notes.length)}
            className="rounded-lg p-1.5 hover:bg-surface-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
