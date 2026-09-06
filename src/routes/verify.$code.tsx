import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, ChevronLeft, ShieldAlert, ShieldCheck } from "lucide-react";

import { findPassportByCode } from "@/lib/ams/passport-id";

/**
 * The page every AMS verification QR points at.
 *
 * `PassportQR` and `CredentialQR` generate a genuinely scannable QR encoding
 * an absolute URL to /verify/<code>, and both render a "Verify" link beside it.
 * The route those codes resolve to had never been created, so every scan and
 * every click landed on a 404 — the one moment where the credential is supposed
 * to prove itself is the moment it failed.
 *
 * `findPassportByCode` already existed in lib/ams/passport-id and was unused;
 * this page is the consumer it was written for. Codes are derived from the role
 * rather than stored, so verification is a lookup against the issued registry,
 * with no database round trip and nothing invented for display.
 *
 * The page is deliberately public: a credential nobody can check without an
 * account is not a credential. It exposes only what is printed on the passport
 * itself.
 */
export const Route = createFileRoute("/verify/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Verify ${params.code} — Software Vala AMS Registry` },
      {
        name: "description",
        content:
          "Check a Software Vala digital passport or credential against the AMS Global Registry.",
      },
      // A verification result is per-code and worthless in search results.
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: VerifyPage,
});

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}

function VerifyPage() {
  const { code } = Route.useParams();
  const match = findPassportByCode(code);

  if (!match) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-destructive" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">Not a recognised credential</h1>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            No passport in the AMS Global Registry carries the code{" "}
            <span className="font-mono text-foreground">{code}</span>. Check the code printed
            beneath the QR, or scan the credential again.
          </p>
        </div>
        <Link
          to="/ams/passport-vault"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Passport Vault
        </Link>
      </main>
    );
  }

  const { role, identity } = match;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 p-6">
      <div
        className="rounded-2xl border p-6"
        style={{
          borderColor: `${role.accent}55`,
          background: `linear-gradient(135deg, ${role.accent}14, transparent)`,
        }}
      >
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0" style={{ color: role.accent }} aria-hidden="true" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">{identity.verification}</h1>
            <p className="text-xs text-muted-foreground">
              Verified against the AMS Global Registry
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-border/50 pt-5">
          <span className="text-2xl" aria-hidden="true">
            {role.glyph}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {role.name}
              <BadgeCheck className="h-4 w-4" style={{ color: role.accent }} aria-hidden="true" />
            </div>
            <div className="truncate text-xs text-muted-foreground">{role.archetype}</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Passport No." value={identity.number} />
          <Field label="Verification code" value={identity.code} />
          <Field label="Serial" value={identity.serial} />
          <Field label="Checksum" value={identity.checksum} />
          <Field label="Issued" value={identity.issued} />
          <Field label="Expires" value={identity.expires} />
        </div>

        <div className="mt-5 border-t border-border/50 pt-4">
          <Field label="Issuing authority" value={identity.authority} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/ams/role-showcase/$slug"
          params={{ slug: role.slug }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          About the {role.name} role
        </Link>
        <Link
          to="/ams/passport-vault"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Passport Vault
        </Link>
      </div>
    </main>
  );
}
