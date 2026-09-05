import { useEffect, useMemo, useState } from "react";
import { CornerDownLeft, Search, X } from "lucide-react";
import { SECTIONS, type SectionId } from "./TopBar";

/** Global module search — wires the header search button to real navigation. */
export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: SectionId) => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = SECTIONS as unknown as Array<{
      id: string;
      label: string;
      groupLabel?: string;
      icon: React.ComponentType<{ className?: string }>;
    }>;
    if (!n) return list.slice(0, 12);
    return list
      .filter((s) => `${s.label} ${s.groupLabel ?? ""}`.toLowerCase().includes(n))
      .slice(0, 24);
  }, [q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      }
      if (e.key === "Enter" && results[cursor]) {
        onNavigate(results[cursor].id as SectionId);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, onClose, onNavigate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-background/80 p-4 backdrop-blur-md">
      <button className="absolute inset-0" onClick={onClose} aria-label="Close search" />
      <div className="relative mt-[10vh] w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-card shadow-[0_40px_120px_-40px_oklch(0.62_0.19_255/0.7)]">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            placeholder="Search every module…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No module matches “{q}”.</p>
          )}
          {results.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onMouseEnter={() => setCursor(i)}
                onClick={() => {
                  onNavigate(s.id as SectionId);
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  i === cursor ? "bg-primary/20 text-foreground" : "text-muted-foreground hover:bg-white/[0.05]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate font-medium">{s.label}</span>
                <span className="hidden shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">
                  {s.groupLabel}
                </span>
                {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
