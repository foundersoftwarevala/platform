import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import { DMFullLayout } from "@/components/developer-management/DMFullLayout";
import { Toaster } from "@/components/ui/sonner";

/**
 * Developer Manager — the developer operations control tower.
 *
 * The Control Panel has listed "Development Manager" for a while, pointing at
 * /dashboard/dev-manager: the generic role dashboard, a KPI grid and a module
 * list, not a manager. The seventeen screens its own menu describes did not
 * exist.
 *
 * They do now, mounted here with the module's own internal navigation —
 * Overview, People & Skills, Work Pipeline, Performance & Payout, Governance —
 * inside Software Vala's Control Panel rather than beside it. The generic
 * /dashboard/dev-manager route is left exactly as it was.
 *
 * This module reads the developer tables Software Vala already had rather than
 * a second set of its own: developers, developer_tasks, developer_code_submissions
 * and developer_activity_logs, each with the row-level security they already
 * carried. Two things were genuinely missing and were added —
 * developer_task_escalations and developer_task_internal_notes — the second of
 * which is operator-only in both directions, because an internal note must never
 * become readable by the developer it is written about.
 *
 * Access uses the project's existing RBAC. Nothing here introduces a second way
 * to sign in: the source shipped a role-switch dropdown that collected its own
 * username, password and licence keys, and that was left behind.
 */
export const Route = createFileRoute("/dev-manager")({
  head: () => ({
    meta: [
      { title: "Developer Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Developer operations: registry, onboarding, skills, tasks, sprints, builds, submissions, review and QA, bugs, performance, payment, compliance, security and audit.",
      },
      { property: "og:title", content: "Developer Manager — Software Vala" },
      {
        property: "og:description",
        content: "Run the developer lifecycle end to end from one control tower.",
      },
      // An operations console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DevManagerRoute,
  // One screen failing must never take the Control Panel down with it.
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <section className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Developer Manager could not start</h1>
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

function DevManagerRoute() {
  return (
    <RequireRole role={["developer"]}>
      <div className="creator-theme min-h-screen">
        <DMFullLayout />
        <Toaster richColors position="bottom-right" />
      </div>
    </RequireRole>
  );
}
