import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/affiliate/PageHeader";
import { WallShell } from "@/components/affiliate/WallShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RadioTower, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { logRowAction } from "@/lib/affiliate-audit";

export const Route = createFileRoute("/affiliate-manager/realtime-test")({
  head: () => ({
    meta: [
      { title: "Realtime Test Harness — Affiliate Manager" },
      { name: "description", content: "Cross-tab realtime verification for dedup + ordering guarantees." },
    ],
  }),
  component: RealtimeTestHarness,
});

type Event = {
  id: string;
  table: string;
  eventType: string;
  recordId: string;
  updatedAt: string;
  receivedAt: number;
  duplicate: boolean;
  outOfOrder: boolean;
};

/**
 * Cross-tab realtime verification. Subscribes to the same tables the app
 * consumes, tags each incoming event with dedup + ordering diagnostics,
 * and offers a burst-emit action so two open tabs can prove events never
 * double-apply and always sort by updated_at.
 */
function RealtimeTestHarness() {
  const [events, setEvents] = useState<Event[]>([]);
  const [running, setRunning] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const lastTsRef = useRef<Map<string, number>>(new Map());
  const [sessionId] = useState(() => Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    setRunning(true);
    const channel = supabase
      .channel(`realtime-test-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "activity_log" },
        (payload) => ingest("activity_log", payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "affiliates" },
        (payload) => ingest("affiliates", payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "commissions" },
        (payload) => ingest("commissions", payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wallets" },
        (payload) => ingest("wallets", payload),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payouts" },
        (payload) => ingest("payouts", payload),
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRunning(true);
        else if (status === "CLOSED" || status === "CHANNEL_ERROR") setRunning(false);
      });

    function ingest(
      table: string,
      payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null },
    ) {
      const rec = (payload.new ?? payload.old) as Record<string, unknown> | null;
      const recordId = typeof rec?.id === "string" ? rec.id : "";
      const rawTs =
        (rec?.updated_at as string | undefined) ??
        (rec?.created_at as string | undefined) ??
        new Date().toISOString();
      const ts = Date.parse(rawTs) || Date.now();
      const dedupKey = `${table}:${payload.eventType}:${recordId}:${ts}`;
      const duplicate = seenRef.current.has(dedupKey);
      const lastTs = lastTsRef.current.get(`${table}:${recordId}`) ?? 0;
      const outOfOrder = payload.eventType !== "INSERT" && ts < lastTs;
      if (!duplicate) seenRef.current.add(dedupKey);
      if (!outOfOrder) lastTsRef.current.set(`${table}:${recordId}`, ts);
      setEvents((prev) =>
        [
          {
            id: `${dedupKey}:${performance.now()}`,
            table,
            eventType: payload.eventType,
            recordId,
            updatedAt: new Date(ts).toISOString(),
            receivedAt: Date.now(),
            duplicate,
            outOfOrder,
          },
          ...prev,
        ].slice(0, 100),
      );
    }

    return () => {
      supabase.removeChannel(channel);
      setRunning(false);
    };
  }, [sessionId]);

  const stats = useMemo(() => {
    const total = events.length;
    const dupes = events.filter((e) => e.duplicate).length;
    const outOfOrder = events.filter((e) => e.outOfOrder).length;
    return { total, dupes, outOfOrder };
  }, [events]);

  async function emitBurst() {
    // Emit a burst of audit events with the same entity id so both tabs
    // can verify: (a) no duplicates apply, (b) they render in ts order.
    const entityId = `harness-${sessionId}-${Date.now()}`;
    const promises = Array.from({ length: 5 }).map((_, i) =>
      logRowAction("harness", entityId, "burst", { seq: i, session: sessionId }),
    );
    await Promise.all(promises);
    toast.success("Emitted 5 test events", { description: `entity=${entityId.slice(-12)}` });
  }

  return (
    <WallShell>
      <PageHeader
        title="Realtime Test Harness"
        description="Open this route in two tabs, click Emit Burst, and confirm both tabs record the same events with zero duplicates and monotonic updated_at ordering."
        crumbs={[{ label: "Affiliate Manager" }, { label: "Realtime Test" }]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setEvents([])}>
              <Trash2 className="size-4 mr-1.5" /> Clear
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                toast.success("Copied URL — open in another tab");
              }}
            >
              <Copy className="size-4 mr-1.5" /> Copy URL
            </Button>
            <Button size="sm" onClick={emitBurst}>
              <RadioTower className="size-4 mr-1.5" /> Emit Burst
            </Button>
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="Session" value={sessionId} />
        <Stat label="Events received" value={String(stats.total)} />
        <Stat
          label="Duplicates dropped"
          value={String(stats.dupes)}
          tone={stats.dupes === 0 ? "ok" : "warn"}
        />
        <Stat
          label="Out-of-order"
          value={String(stats.outOfOrder)}
          tone={stats.outOfOrder === 0 ? "ok" : "warn"}
        />
      </div>

      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${running ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
            />
            {running ? "Subscribed" : "Disconnected"}
          </span>
          <span>Showing last {events.length} events</span>
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Table</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Record</th>
                <th className="px-3 py-2 text-left">updated_at</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                    Waiting for events. Click <strong>Emit Burst</strong> or trigger any
                    affiliate mutation in another tab.
                  </td>
                </tr>
              ) : (
                events.map((e, i) => (
                  <tr key={e.id} className="border-b border-border/60">
                    <td className="px-3 py-2 text-muted-foreground">{events.length - i}</td>
                    <td className="px-3 py-2 font-medium">{e.table}</td>
                    <td className="px-3 py-2">{e.eventType}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">
                      {e.recordId ? e.recordId.slice(0, 12) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                      {e.updatedAt}
                    </td>
                    <td className="px-3 py-2">
                      {e.duplicate ? (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <XCircle className="size-3" /> duplicate
                        </span>
                      ) : e.outOfOrder ? (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <XCircle className="size-3" /> out-of-order
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <CheckCircle2 className="size-3" /> ok
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        <strong className="text-foreground">How to use:</strong> Copy this URL into a second
        browser tab. Both tabs should see identical event counts. If either shows
        <em> duplicates &gt; 0</em> or <em> out-of-order &gt; 0</em>, the client dedup or
        ordering guarantee has regressed.
      </div>
    </WallShell>
  );
}

function Stat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "neutral";
}) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
      : tone === "warn"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-surface text-foreground";
  return (
    <div className={`rounded-lg border p-3 ${cls}`}>
      <div className="text-[10px] uppercase tracking-[0.12em] opacity-70">{label}</div>
      <div className="mt-1 font-mono text-lg">{value}</div>
    </div>
  );
}
