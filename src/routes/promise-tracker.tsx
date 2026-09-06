import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import { PTLayout } from "@/components/promise-tracker/PTLayout";
import { Toaster } from "@/components/ui/sonner";

/**
 * Promise Tracker — the commitment register.
 *
 * The Control Panel has listed "Promise Tracker" for a while and pointed it at
 * an empty dashboard. This is the module behind it: thirteen screens covering
 * the overview, every promise, creation, the active, delayed, broken and
 * fulfilled boards, categories, escalations, fine and tip rules, AI insights,
 * the audit log and settings.
 *
 * Four things were built here that the source repository does not have, and
 * they are the ones the module actually rests on.
 *
 * The deadline engine runs without anybody watching. In the source a promise
 * becomes "delayed" because a browser compared its deadline to Date.now(), so a
 * promise that broke overnight was still shown as active in the morning with no
 * reminder sent and no escalation raised. Deadlines, reminders, the four-level
 * escalation ladder and automatic fines are now computed in the database and
 * swept on a schedule.
 *
 * Row-level security enforces something. The source grants SELECT, INSERT,
 * UPDATE and DELETE on all seven of its tables to anon as well as authenticated
 * and writes every policy as USING (true) WITH CHECK (true) — so anyone able to
 * reach the API could read every commitment, rewrite any fine and delete the
 * audit trail. Real policies were written: an owner sees what they promised, a
 * receiver sees what was promised to them, a manager sees their teams', an
 * operator sees the module, and anonymous sees nothing.
 *
 * Money is a record rather than a running total. The source keeps fine_amount
 * and tip_amount as numbers on the promise row, so a fine has no rule behind
 * it, no actor and no history. Fines and tips are now ledger entries naming the
 * rule that caused them; the totals on the promise are a cached sum of those.
 *
 * And nothing was seeded. The source ships twenty-four demo promises describing
 * invented clients, invented breaches and invented fines. A fabricated fine
 * sitting in a finance table is worse than an empty screen, because somebody
 * eventually reads it as money owed.
 */
export const Route = createFileRoute("/promise-tracker")({
  head: () => ({
    meta: [
      { title: "Promise Tracker — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Commitment tracking with live deadlines, a four-level escalation ladder, fines, tips and an immutable audit trail.",
      },
      { property: "og:title", content: "Promise Tracker — Software Vala" },
      {
        property: "og:description",
        content: "One register for every commitment the business makes.",
      },
      // An operations console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PromiseTrackerRoute,
  // One screen failing must never take the Control Panel down with it.
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <section className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Promise Tracker could not start</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <a
          href="/control-panel"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to Control Panel
        </a>
      </section>
    </main>
  ),
});

function PromiseTrackerRoute() {
  return (
    <RequireRole role={["developer", "support", "sales", "finance"]}>
      <div className="creator-theme min-h-screen">
        <PTLayout />
        <Toaster richColors position="bottom-right" />
      </div>
    </RequireRole>
  );
}
