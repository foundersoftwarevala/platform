import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import LMEnterpriseLayout from "@/components/legal-manager/LMEnterpriseLayout";
import { Toaster } from "@/components/ui/sonner";

/**
 * Legal Manager.
 *
 * The Control Panel has listed "Legal Manager" for a while with nothing behind
 * it. This is the module: the fifteen screens from the source repository —
 * dashboard, agreement engine, user and role agreements, product legal binding,
 * login gate control, international law, copyright, trademark, brand and IP,
 * policy management, AI legal intelligence, approvals, audit logs,
 * notifications and settings — plus the document vault, policy compliance,
 * violations, trademark monitor, legal alerts and logs.
 *
 * Four things were built that the source does not have.
 *
 * Authorization exists. The source's policies say what they are out loud —
 * "Legal records are open while auth is disabled", `FOR ALL TO anon,
 * authenticated USING (true)` — and the author never closed them. Applied as
 * shipped, an anonymous caller could read every contract, rewrite a published
 * policy, delete a violation, and through the storage policies read, overwrite
 * and delete the document vault itself. Anonymous now has no grant anywhere and
 * the vault is a private bucket.
 *
 * Versions are records, not strings. The source keeps one `version` field on a
 * policy row and overwrites it. A published agreement that somebody accepted
 * has to remain readable exactly as it was on the day they accepted it, or the
 * acceptance means nothing — so a version is its own row, its text is frozen at
 * publication along with a hash of it, and publishing a new one supersedes the
 * old rather than replacing it.
 *
 * Acceptance exists at all. There is no acceptance table in the source, so
 * nothing recorded that a person had agreed to anything. An acceptance now
 * names the account, the exact version, the hash of the text they were shown
 * and how they accepted it, and it cannot be edited or deleted afterwards.
 *
 * And the login gate is decided by the server. A gate enforced in the browser
 * is decoration: the screen can be skipped and "scrolled to the end" is a claim
 * the client makes about itself. The server decides who still owes an
 * acceptance, refuses one that skipped the reading it required, and puts
 * everybody back into re-accept the moment a new version is published.
 *
 * On the AI: it is advisory throughout, every run is recorded before it starts,
 * and the model is instructed not to invent statutes, cases, regulations or
 * registration numbers and to mark anything it cannot source as unverified. It
 * can still be wrong, which is why every run begins unreviewed and nothing it
 * produces can publish, accept or approve anything by itself.
 */
export const Route = createFileRoute("/legal-manager")({
  head: () => ({
    meta: [
      { title: "Legal Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Agreements, versions and acceptances, policy compliance, copyright and trademark, violations, an advisory AI layer and an immutable legal log.",
      },
      { property: "og:title", content: "Legal Manager — Software Vala" },
      {
        property: "og:description",
        content: "One legal record, versioned, accepted and audited.",
      },
      // An operations console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: LegalManagerRoute,
  // One screen failing must never take the Control Panel down with it.
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <section className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Legal Manager could not start</h1>
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

function LegalManagerRoute() {
  return (
    <RequireRole role={["legal", "finance", "support"]}>
      <div className="creator-theme min-h-screen">
        <LMEnterpriseLayout />
        <Toaster richColors position="bottom-right" />
      </div>
    </RequireRole>
  );
}
