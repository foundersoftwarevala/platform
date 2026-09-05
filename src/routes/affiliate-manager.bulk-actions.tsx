import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layers, History, Filter, Search, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { Tabs, SectionCard, StatusBadge } from "@/components/affiliate/StatusBadge";
import { KpiCard, KpiGrid } from "@/components/affiliate/KpiCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BULK_ACTIONS, BULK_SCOPES, type BulkAction, type BulkScope } from "@/lib/affiliate-bulk";
import { BulkActionDialog } from "@/components/affiliate/BulkActionDialog";
import { EmptyState } from "@/components/affiliate/EmptyState";

export const Route = createFileRoute("/affiliate-manager/bulk-actions")({
  head: () => ({ meta: [{ title: "Bulk Actions — Affiliate Manager" }] }),
  component: BulkActionsWall,
});

function BulkActionsWall() {
  const [scope, setScope] = useState<BulkScope>("affiliates");
  const [count, setCount] = useState<string>("250");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<BulkAction | null>(null);

  const actions = useMemo(
    () =>
      BULK_ACTIONS.filter((a) => a.scope.includes(scope)).filter((a) =>
        a.label.toLowerCase().includes(query.toLowerCase()) ||
        a.description.toLowerCase().includes(query.toLowerCase()),
      ),
    [scope, query],
  );

  const scopeLabel = BULK_SCOPES.find((s) => s.id === scope)?.label ?? scope;
  const numericCount = Math.max(0, parseInt(count || "0", 10) || 0);

  return (
    <>
      <PageHeader
        title="Mass Bulk Actions"
        description="Run approvals, suspensions, messaging, campaign assignment and payout generation across thousands of records with audit, progress and error reporting."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Bulk Actions" }]}
        actions={
          <>
            <Button variant="outline" size="sm" className="gap-1.5">
              <History className="size-3.5" /> Operation History
            </Button>
            <Button size="sm" asChild>
              <Link to="/affiliate-manager/import">Import to Select</Link>
            </Button>
          </>
        }
      />
      <Tabs items={["Run", "Scheduled", "History", "Audit Log", "Approvers"]} />
      <WallShell>
        <KpiGrid>
          <KpiCard label="Available Actions" value={BULK_ACTIONS.length.toString()} icon={<Layers className="size-4" />} tone="primary" />
          <KpiCard label="Selected Scope" value={scopeLabel} />
          <KpiCard label="Selection Size" value={numericCount.toLocaleString()} />
          <KpiCard label="Running" value="0" />
          <KpiCard label="Queued" value="0" />
          <KpiCard label="Failed 24h" value="0" tone="destructive" />
        </KpiGrid>

        <SectionCard title="Selection">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Target Workspace">
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as BulkScope)}
                className="h-9 w-full rounded-md border border-border bg-muted/40 px-2 text-sm"
              >
                {BULK_SCOPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Selection Size">
              <Input
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/[^0-9]/g, ""))}
                className="h-9 bg-muted/40"
                placeholder="0"
              />
            </Field>
            <Field label="Source">
              <div className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 text-sm text-muted-foreground">
                Current filter on{" "}
                <Link
                  to={BULK_SCOPES.find((s) => s.id === scope)!.route}
                  className="text-primary hover:underline"
                >
                  {scopeLabel} wall
                </Link>
              </div>
            </Field>
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 lg:px-6 py-2.5 rounded-t-lg">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search actions…"
              className="h-9 pl-8 bg-muted/60"
            />
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Filter className="size-3.5" /> All categories
          </Button>
          <div className="ml-auto text-[12px] text-muted-foreground">
            {actions.length} action{actions.length === 1 ? "" : "s"} available
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="rounded-b-lg border border-t-0 border-border bg-surface">
            <EmptyState
              icon={Layers}
              title="No matching actions"
              description="Adjust the workspace or clear the search to see all bulk operations."
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {actions.map((a) => {
              const Icon = a.icon;
              const tone =
                a.tone === "destructive"
                  ? "destructive"
                  : a.tone === "warning"
                  ? "warning"
                  : a.tone === "success"
                  ? "success"
                  : a.tone === "primary"
                  ? "primary"
                  : "neutral";
              return (
                <button
                  key={a.id}
                  onClick={() => setActive(a)}
                  className="group flex flex-col items-stretch gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-border-strong hover:bg-muted/30"
                >
                  <div className="flex items-start gap-3">
                    <div className={`grid size-10 place-items-center rounded-md ${
                      tone === "destructive" ? "bg-destructive/10 text-destructive" :
                      tone === "warning" ? "bg-warning/15 text-warning-foreground" :
                      tone === "success" ? "bg-success/10 text-success" :
                      tone === "primary" ? "bg-primary-soft text-primary" :
                      "bg-muted text-foreground"
                    }`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-display text-sm font-semibold">{a.label}</div>
                        {a.destructive && <StatusBadge tone="destructive">Destructive</StatusBadge>}
                      </div>
                      <div className="mt-1 text-[12px] text-muted-foreground line-clamp-2">{a.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                    <span>~{a.estimatedRate}/s · audit logged</span>
                    <span className="inline-flex items-center gap-1 text-primary group-hover:translate-x-0.5 transition-transform">
                      Configure <ChevronRight className="size-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <SectionCard title="Recent Operations">
          <EmptyState
            icon={History}
            title="No bulk operations run yet"
            description="Completed batches appear here with full audit trail, downloadable success and error reports."
          />
        </SectionCard>
      </WallShell>

      <BulkActionDialog
        open={!!active}
        onOpenChange={(v) => !v && setActive(null)}
        action={active}
        selectedCount={numericCount}
        scopeLabel={scopeLabel.toLowerCase()}
      />
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
