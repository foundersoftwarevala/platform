import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import { AMFullLayout } from "@/components/assist-manager/AMFullLayout";
import { Toaster } from "@/components/ui/sonner";

/**
 * Assist Manager — remote assistance, under authorization.
 *
 * The Control Panel has listed "Assist Manager" for a while and pointed it at
 * the support agent screen. This is the module: fifteen screens covering the
 * dashboard, active sessions, creation, requests, approvals, the live
 * workspace, privacy, device access, screen control, file transfer, chat and
 * voice, logs, the AI layer, emergency stop and settings.
 *
 * Four things were built here that the source repository does not have, and on
 * a module that attaches to somebody's screen they are not optional.
 *
 * Authorization exists. The source ships thirty-seven row-level policies and
 * every one reads `FOR ALL TO anon, authenticated USING (true)`. An anonymous
 * caller could list every session in the business, read the chat inside them,
 * see which files moved, raise a request against anybody, approve it, and
 * switch off an access restriction. Anonymous now has no grant anywhere, and
 * what a signed-in person sees depends on whether they are an operator, the
 * agent on the session, or its target.
 *
 * Sessions belong to real people. Nothing in the source schema references
 * auth.users: a session points at `assist_end_users`, whose rows are codes like
 * "USR-****42". So the person whose screen is being watched was not anybody the
 * platform knew, and no approval could be traced to an account. Sessions now
 * carry the target and the operator directly.
 *
 * Consent is separate from approval. The source has a manager signing off and
 * no record of the target agreeing — but being watched because your manager
 * allowed it is not the same as being watched because you said yes. Consent is
 * now the target's alone to give, theirs alone to withdraw, and withdrawing it
 * ends the session rather than flagging it.
 *
 * And the emergency stop actually stops things. In the source it sets the
 * session's status to terminated, which revokes nothing: the control state
 * stays as it was, transfers in flight stay open, shared windows stay shared
 * and the AI layer keeps its session. It now revokes screen, cursor, keyboard,
 * voice, file transfer, device access and the AI layer together, expires any
 * approval that could revive the session, and writes the reason.
 *
 * No sessions were seeded. The source ships a live one with a named agent and a
 * stated purpose; of all the fabricated data in this platform, a fake
 * remote-control session is the one most likely to be read as something that
 * really happened to somebody.
 */
export const Route = createFileRoute("/assist-manager")({
  head: () => ({
    meta: [
      { title: "Assist Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Remote assistance under approval and consent: sessions, privacy controls, device access, screen control, file transfer, chat and an immutable audit trail.",
      },
      { property: "og:title", content: "Assist Manager — Software Vala" },
      {
        property: "og:description",
        content: "One authoritative assist session, from request to audit.",
      },
      // An operations console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AssistManagerRoute,
  // One screen failing must never take the Control Panel down with it.
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <section className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Assist Manager could not start</h1>
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

function AssistManagerRoute() {
  return (
    <RequireRole role={["support", "developer", "sales"]}>
      <div className="creator-theme min-h-screen">
        <AMFullLayout />
        <Toaster richColors position="bottom-right" />
      </div>
    </RequireRole>
  );
}
