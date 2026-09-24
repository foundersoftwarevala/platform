import { useEffect, useState, type ComponentType } from "react";

import { authHeaders } from "@/lib/auth/operator-fetch";
import { Card, EmptyHint, PageHeader, StatCard, SubNav } from "../ui";
import { LiveTable } from "../LiveTable";

/**
 * A designed module screen, over the table it was designed for.
 *
 * Two dozen sections of the Marketplace Manager were built as ModulePage
 * shells: a title, a row of tabs, four counters showing an em dash, and a
 * feature matrix under the words "Awaiting live data". Behind several of them
 * the data had been there all along - eleven authors, fifteen resellers, ten
 * creators, seven posts.
 *
 * This is the same screen with the waiting over. It keeps the eyebrow, the
 * title, the description, the tabs in their order and the counters with their
 * labels; each tab is the real table read through the endpoint every other
 * connected section uses. A tab with no table behind it says so rather than
 * showing an empty grid as though the answer were zero.
 */

export type ModuleTab = {
  label: string;
  /** The resource this tab reads, or nothing where the platform has none. */
  resource?: string;
  columns?: string[];
  /** Shown in place of a table when there is no resource. */
  absent?: string;
  /** Narrows the table to part of it, e.g. only the verified rows. */
  filter?: Record<string, string>;
};

export type ModuleCounter = {
  label: string;
  tone?: "default" | "success" | "warning" | "premium" | "destructive";
  /** Counts the rows of this resource; a filter narrows what is counted. */
  resource?: string;
  filter?: Record<string, string>;
  /** Where the platform holds nothing for this figure, say so on hover. */
  absent?: string;
};

export function LiveModule({
  eyebrow,
  title,
  description,
  Icon,
  tabs,
  counters,
  footnote,
}: {
  eyebrow: string;
  title: string;
  description: string;
  Icon: ComponentType<{ className?: string }>;
  tabs: ModuleTab[];
  counters: ModuleCounter[];
  footnote?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.label ?? "");
  const [figures, setFigures] = useState<Record<string, number> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const wanted = counters.filter((c) => c.resource);
      if (wanted.length === 0) {
        setFigures({});
        return;
      }
      try {
        const headers = await authHeaders();
        const found: Record<string, number> = {};
        await Promise.all(
          wanted.map(async (counter) => {
            const query = new URLSearchParams({ resource: counter.resource!, limit: "500" });
            const res = await fetch(`/api/manager/resource?${query}`, { headers });
            if (!res.ok) throw new Error(String(res.status));
            const payload = (await res.json()) as { rows?: Record<string, unknown>[]; total?: number };
            const rows = payload.rows ?? [];
            const narrowed = counter.filter
              ? rows.filter((row) =>
                  Object.entries(counter.filter!).every(([k, v]) => String(row[k] ?? "") === v),
                )
              : null;
            found[counter.label] = narrowed ? narrowed.length : (payload.total ?? rows.length);
          }),
        );
        if (alive) setFigures(found);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [counters]);

  const value = (counter: ModuleCounter) => {
    if (counter.absent) return "—";
    if (failed) return "—";
    if (figures === null) return "…";
    return String(figures[counter.label] ?? 0);
  };

  const current = tabs.find((t) => t.label === active) ?? tabs[0];

  return (
    <div className="px-4 py-8 md:px-8">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />

      <SubNav items={tabs.map((t) => t.label)} active={active} onChange={setActive} />

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {counters.map((counter) => (
          <div key={counter.label} title={counter.absent ?? undefined}>
            <StatCard label={counter.label} value={value(counter)} tone={counter.tone ?? "default"} />
          </div>
        ))}
      </div>

      <div className="mt-6">
        {current?.resource ? (
          <LiveTable
            key={current.label}
            resource={current.resource}
            title={current.label}
            {...(current.columns ? { columns: current.columns } : {})}
            description={`Reading ${current.label.toLowerCase()}…`}
          />
        ) : (
          <Card>
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Icon className="h-4 w-4 text-accent" /> {current?.label}
            </div>
            <EmptyHint text={current?.absent ?? "This platform holds nothing behind this tab yet."} />
          </Card>
        )}
      </div>

      {footnote && <p className="mt-4 text-[11px] text-muted-foreground">{footnote}</p>}
    </div>
  );
}
