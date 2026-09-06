import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import { TMShell } from "@/components/tm/TMShell";
import { Toaster } from "@/components/ui/sonner";

/**
 * Task Manager — the central task control tower.
 *
 * The Control Panel has listed "Task Manager" for a while and said plainly that
 * nothing was built behind it. This is the module: twenty-one screens across
 * Command, Intake, Delivery, Assurance, Insights and System, with its own
 * navigation inside the Control Panel rather than beside it.
 *
 * Three things were built here that the source repository does not have, and
 * they are the ones the design actually rests on.
 *
 * The claim is atomic. The source's buzzer flow ends at `acknowledgeBuzzer`, a
 * bare UPDATE setting a boolean, so two users racing for the same task would
 * both have succeeded and both believed they owned it. Ownership is now decided
 * by `tm_claim_task` — one conditional UPDATE holding a row lock — and proved
 * against the real database with simultaneous callers.
 *
 * Row-level security enforces something. The source enables RLS on all fourteen
 * tables and then writes every policy as `FOR ALL USING (true)`, which grants
 * everything to everyone. Real policies were written instead: an operator sees
 * the board, a member sees their own work and whatever is still claimable, and
 * anonymous is refused.
 *
 * Members are real accounts. `tm_members` had no link to auth.users, so nothing
 * could be tied to the signed-in person. It now carries user_id, which is what
 * makes both of the above possible.
 */
export const Route = createFileRoute("/task-manager")({
  head: () => ({
    meta: [
      { title: "Task Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "The central task control tower: inbox, pipeline, buzzer, assignment, execution, review, SLA, escalation, wallet, analytics and audit.",
      },
      { property: "og:title", content: "Task Manager — Software Vala" },
      {
        property: "og:description",
        content: "One canonical task lifecycle for every module in the platform.",
      },
      // An operations console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TaskManagerRoute,
  // One screen failing must never take the Control Panel down with it.
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <section className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Task Manager could not start</h1>
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

function TaskManagerRoute() {
  return (
    <RequireRole role={["developer", "support", "sales"]}>
      <div className="creator-theme min-h-screen">
        <TMShell />
        <Toaster richColors position="bottom-right" />
      </div>
    </RequireRole>
  );
}
