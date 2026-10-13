import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, RefreshCw } from "lucide-react";
import { devDashboardFn } from "@/lib/vala-ai/studio/developer/developer.functions";
import { useOperator } from "../session";

export function StudioOverview({ owner = false }: { owner?: boolean }) {
  const operator = useOperator();
  const [data, setData] = useState<Awaited<ReturnType<typeof devDashboardFn>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    setError(null);
    try {
      setData(await devDashboardFn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Overview could not load.");
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const stats = [
    ["Projects", data?.projects.length],
    ["Library items", data?.librarySize],
    ["Versions", data?.versions.length],
    ["Recent events", data?.logs.length],
  ] as const;
  return (
    <div className="mx-auto max-w-[1040px] space-y-6 px-6 py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] tracking-[0.2em] text-studio-dim">OVERVIEW</div>
          <h1 className="mt-1 text-2xl font-semibold">{owner ? "Hello, Vala AI" : "Overview"}</h1>
          <p className="mt-2 text-sm text-studio-dim">
            Real module projects, source library and append-only history.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/vala-ai/builder"
            className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs"
          >
            <FlaskConical className="size-4" />
            Open Lab
          </Link>
          <button
            onClick={() => void refresh()}
            aria-label="Refresh overview"
            className="rounded-lg border border-border px-3"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, value]) => (
          <section
            key={label}
            className={`rounded-xl border border-border p-5 ${owner ? "bg-secondary" : "bg-card"}`}
          >
            <h2 className="text-xs text-studio-dim">{label}</h2>
            <p className="mt-3 text-3xl font-semibold">{value ?? "—"}</p>
          </section>
        ))}
      </div>
      <p className="text-xs text-studio-dim">
        Counts reflect the loaded dashboard scope (latest 100 projects, 200 versions and 50 events).
        Revenue, subscriptions and payment totals are not supplied by this module.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-secondary p-4">
          <h2 className="text-sm font-medium">Latest activity</h2>
          {!data ? (
            <p className="mt-4 text-xs text-studio-dim">
              {error ? "UNVERIFIED — load failed." : "Loading..."}
            </p>
          ) : !data.logs.length ? (
            <p className="mt-4 text-xs text-studio-dim">No module activity yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {data.logs.map((log) => (
                <li key={log.id} className="rounded-lg bg-background p-3 text-xs">
                  <div>{log.action}</div>
                  <time className="text-studio-dim">
                    {new Date(log.created_at).toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="self-start rounded-xl border border-border bg-secondary p-4">
          <h2 className="text-sm font-medium">Control Panel account</h2>
          <p className="mt-4 text-sm">{operator.email}</p>
          <p className="mt-1 text-xs text-studio-dim">
            {operator.role} · existing authenticated session
          </p>
          <Link to="/control-panel" className="mt-4 inline-block text-xs text-primary">
            Manage platform access
          </Link>
        </section>
      </div>
    </div>
  );
}
