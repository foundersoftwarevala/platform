import { Toaster } from "@/components/ui/sonner";
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  FileSignature,
  LayoutDashboard,
  Loader2,
  Send,
  ShieldCheck,
} from "lucide-react";
import "@/styles/marketplace-home.css";
import { getRole, type Field } from "@/lib/applications/config";
import { checkDocument, DOCUMENT_ACCEPT } from "@/lib/applications/documents";
import { partnerHashtags, partnerSeo, partnerStructuredData } from "@/lib/seo/partner-opportunity";
import { absoluteUrl } from "@/lib/seo/site-url";
import { supabase } from "@/integrations/supabase/client";
import { authHeaders } from "@/lib/auth/operator-fetch";
import { useTranslation } from "@/lib/i18n/use-translation";

type Upload = { field: string; label: string; name: string; ok: boolean; error?: string };

type Submitted = {
  kind: string;
  id: string | null;
  number: string;
  status: string;
  duplicate: boolean;
  /** Vendor and author share one seller record per account; this names the one held. */
  conflict: boolean;
  existingKind: string | null;
  uploads: Upload[];
};

/** Roles whose application reaches a server table and a manager workflow. */
const ONLINE_ROLES: ReadonlySet<string> = new Set([
  "reseller", "vendor", "author", "franchise", "influencer", "affiliate",
]);

/**
 * Every role goes to the same server path, which checks the form's fields,
 * encrypts the secret ones and calls the role's own database function as the
 * applicant - the function numbers the application, refuses a second open one
 * and notifies. Status and approval are set by staff only. Documents are not
 * part of this: they are uploaded to the application once it exists.
 */
async function submitToServer(
  role: string,
  values: Record<string, string>,
): Promise<Omit<Submitted, "uploads">> {
  const response = await fetch("/api/applications/submit", {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ role, values, agreementAccepted: true }),
  });
  const body = (await response.json().catch(() => ({}))) as Partial<Submitted> & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "The application could not be submitted.");
  return {
    kind: body.kind ?? role,
    id: body.id ?? null,
    number: body.number ?? "",
    status: body.status ?? "pending",
    duplicate: body.duplicate === true,
    conflict: body.conflict === true,
    existingKind: body.existingKind ?? null,
  };
}

/** One document, uploaded to the application it belongs to. */
async function uploadDocument(
  kind: string,
  applicationId: string,
  field: string,
  file: File,
): Promise<string | null> {
  const form = new FormData();
  form.set("kind", kind);
  form.set("applicationId", applicationId);
  form.set("field", field);
  form.set("file", file);
  const response = await fetch("/api/applications/documents", {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
  if (response.ok) return null;
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? "The document could not be uploaded.";
}

export const Route = createFileRoute("/apply/$role")({
  head: ({ params }) => {
    const role = getRole(params.role);
    const title = role ? `${role.label} — Software Vala Application` : "Apply — Software Vala";
    const description = role
      ? `${role.tagline}. Complete the ${role.label.replace("Become ", "")} application form, accept the agreement and submit for approval.`
      : "Choose a role and apply to join the Software Vala marketplace.";

    /**
     * These pages exist to be found by someone looking for a business
     * opportunity, and they carried only a title, a description and og:type.
     * The partner set adds the phrases such a person actually searches, the
     * hashtags a post about the programme should carry, a sentence written for
     * a social card rather than for a form, and structured data describing the
     * offer.
     *
     * Nothing here claims an earnings figure, a partner count or a rating,
     * because none is verified. The structured data is an Organization with an
     * Offer and not a JobPosting: a partner programme is not employment, and
     * markup that pretends otherwise is treated as spam.
     */
    const seo = role ? partnerSeo(role.key) : null;
    const url = absoluteUrl(role ? `/apply/${role.key}` : "/apply");
    const social = seo?.share ?? description;
    const hashtags = role ? partnerHashtags(role.key) : [];

    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title },
        { name: "description", content: description },
        ...(seo?.keywords.length ? [{ name: "keywords", content: seo.keywords.join(", ") }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: social },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Software Vala" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: social },
        // The hashtags travel with the page so anything that shares it - a
        // person, or the publisher that posts on the business's behalf - uses
        // the same set rather than inventing its own.
        ...(hashtags.length ? [{ name: "article:tag", content: hashtags.join(" ") }] : []),
        { name: "robots", content: "index, follow, max-image-preview:large" },
      ],
      scripts: role
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(
                partnerStructuredData({
                  roleKey: role.key,
                  roleLabel: role.label.replace(/^Become\s+/i, ""),
                  url,
                  description,
                }),
              ),
            },
          ]
        : [],
    };
  },
  component: ApplyRolePage,
});

const inputCls =
  "w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-[13px] text-white outline-none transition placeholder:text-white/35 focus:border-cyan-300/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-cyan-400/25";

function FieldInput({
  field,
  value,
  onChange,
  onFile,
  hint,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  /** A document field hands over the file itself; its name is never kept as a value. */
  onFile?: (file: File | null, input: HTMLInputElement) => void;
  /** Shown under a document field: what may be uploaded. */
  hint?: string;
}) {
  const id = `f_${field.name}`;
  return (
    <div className={field.half ? "sm:col-span-1" : "sm:col-span-2"}>
      <label htmlFor={id} className="mb-1.5 block text-[11.5px] font-semibold tracking-wide text-white/70">
        {field.label}
        {field.required && <span className="ml-1 text-rose-300">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          rows={3}
          required={field.required}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          required={field.required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} appearance-none`}
        >
          <option value="" className="bg-[#0b1a30]">
            Select…
          </option>
          {field.options?.map((o) => (
            <option key={o} value={o} className="bg-[#0b1a30]">
              {o}
            </option>
          ))}
        </select>
      ) : field.type === "file" ? (
        <>
          <input
            id={id}
            type="file"
            accept={DOCUMENT_ACCEPT}
            onChange={(e) => onFile?.(e.target.files?.[0] ?? null, e.target)}
            className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/20 file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-cyan-100`}
          />
          {hint && <p className="mt-1 text-[10.5px] text-white/45">{hint}</p>}
        </>
      ) : (
        <input
          id={id}
          type={field.type}
          required={field.required}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      )}
    </div>
  );
}

function ApplyRolePage() {
  const { t } = useTranslation();
  const { role: roleKey } = Route.useParams();
  const role = getRole(roleKey);
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [application, setApplication] = useState<Submitted | null>(null);
  // The documents themselves, by field. They are uploaded once the application
  // exists; until then they stay here and never become text in `values`.
  const [files, setFiles] = useState<Record<string, File>>({});
  const [retrying, setRetrying] = useState(false);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const pickFile = (field: Field, file: File | null, input: HTMLInputElement) => {
    if (!file) {
      setFiles(({ [field.name]: _drop, ...rest }) => rest);
      return;
    }
    const problem = checkDocument(file);
    if (problem) {
      toast.error(t("apply.document_invalid", { field: field.label, problem }));
      input.value = "";
      setFiles(({ [field.name]: _drop, ...rest }) => rest);
      return;
    }
    setFiles((current) => ({ ...current, [field.name]: file }));
  };

  /** Uploads the chosen documents to an application, one by one, and says what happened to each. */
  const uploadAll = async (
    kind: string,
    applicationId: string,
    fields: string[],
  ): Promise<Upload[]> => {
    const labels = new Map(
      (role?.sections ?? []).flatMap((s) => s.fields).map((f) => [f.name, f.label]),
    );
    const results: Upload[] = [];
    for (const field of fields) {
      const file = files[field];
      if (!file) continue;
      const error = await uploadDocument(kind, applicationId, field, file);
      results.push({
        field,
        label: labels.get(field) ?? field,
        name: file.name,
        ok: !error,
        error: error ?? undefined,
      });
    }
    return results;
  };
  const acceptsOnline = role ? ONLINE_ROLES.has(role.key) : false;

  const progress = useMemo(() => {
    if (!role) return 0;
    const required = role.sections.flatMap((s) => s.fields).filter((f) => f.required);
    if (!required.length) return 100;
    const filled = required.filter((f) => (values[f.name] ?? "").trim().length > 0).length;
    return Math.round((filled / required.length) * 100);
  }, [role, values]);

  if (!role) {
    return (
      <div className="mpc-home flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-black">Application not found</h1>
        <p className="text-sm text-white/60">That role does not exist. Pick one of the available applications.</p>
        <Link to="/apply" className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-2.5 text-[13px] font-bold">
          View all applications
        </Link>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error("Please accept the agreement to continue.");
      return;
    }
    if (!acceptsOnline) return;
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error(t("apply.sign_in_first"));
      void navigate({ to: "/login", search: { redirect: `/apply/${role.key}` } as never });
      return;
    }
    setBusy(true);
    try {
      const result = await submitToServer(role.key, values);
      // Documents go to this application only if it is this role's own and
      // still waiting - never onto the other seller kind's application.
      const canAttach =
        !result.conflict && result.id && ["pending", "in_review"].includes(result.status);
      const uploads = canAttach
        ? await uploadAll(result.kind, result.id as string, Object.keys(files))
        : [];
      setApplication({ ...result, uploads });
      if (result.conflict)
        toast.error(t("apply.conflict_title", { kind: result.existingKind ?? "" }));
      else toast.success(result.duplicate ? t("apply.already_applied") : t("apply.submitted"));
      if (uploads.some((u) => !u.ok)) toast.error(t("apply.documents_some_failed"));
    } catch (problem) {
      toast.error(problem instanceof Error ? problem.message : t("apply.failed"));
    } finally {
      setBusy(false);
    }
  };

  if (application) {
    return (
      <div className="mpc-home min-h-screen px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/12 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
          <h1
            className="mt-4 text-2xl font-black"
            data-application-conflict={application.conflict ? "" : undefined}
          >
            {application.conflict
              ? t("apply.conflict_title", { kind: application.existingKind ?? "" })
              : application.duplicate
                ? t("apply.already_applied")
                : t("apply.submitted")}
          </h1>
          {application.conflict && (
            <p className="mt-3 text-[13px] leading-relaxed text-amber-100/90">
              {t("apply.conflict_body", { kind: application.existingKind ?? "", role: role.key })}
            </p>
          )}
          <p className="mt-3 text-[13px] text-white/60">{t("apply.number")}</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-wider text-cyan-200" data-application-number>
            {application.number}
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/65" data-application-status={application.status}>
            {t("apply.status", { status: application.status })}{" "}
            {role.key === "reseller" ? t("reseller.apply.next") : t("apply.next")}
          </p>
          {application.uploads.length > 0 && (
            <div
              className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-left"
              data-application-documents
            >
              <p className="text-[12px] font-bold uppercase tracking-wider text-white/55">
                {t("apply.documents")}
              </p>
              <ul className="mt-2 space-y-1.5 text-[12.5px]">
                {application.uploads.map((u) => (
                  <li
                    key={u.field}
                    data-document-field={u.field}
                    data-document-ok={u.ok ? "" : undefined}
                  >
                    <span className="font-semibold">{u.label}</span>{" "}
                    <span className="text-white/55">— {u.name}</span>{" "}
                    <span className={u.ok ? "text-emerald-300" : "text-rose-300"}>
                      {u.ok
                        ? t("apply.document_uploaded")
                        : t("apply.document_failed", { error: u.error ?? "" })}
                    </span>
                  </li>
                ))}
              </ul>
              {application.uploads.some((u) => !u.ok) && application.id && (
                <button
                  type="button"
                  disabled={retrying}
                  onClick={async () => {
                    setRetrying(true);
                    const failed = application.uploads.filter((u) => !u.ok).map((u) => u.field);
                    const again = await uploadAll(
                      application.kind,
                      application.id as string,
                      failed,
                    );
                    const byField = new Map(again.map((u) => [u.field, u]));
                    setApplication({
                      ...application,
                      uploads: application.uploads.map((u) => byField.get(u.field) ?? u),
                    });
                    setRetrying(false);
                  }}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[12px] font-bold disabled:opacity-60"
                >
                  {retrying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t("apply.documents_retry")}
                </button>
              )}
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[13px] font-bold">
              {t("apply.home")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mpc-home min-h-screen px-4 pb-20 pt-8 sm:px-6">
      <Toaster />
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/apply" })}
          className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[12px] font-semibold text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All applications
        </button>

        <header className={`overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br ${role.accent} p-[1px]`}>
          <div className="rounded-[calc(1.5rem-1px)] bg-[#0a1526]/85 px-6 py-7 backdrop-blur-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/80">
              <BadgeCheck className="h-3 w-3" /> Role application
            </span>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{role.label}</h1>
            <p className="mt-2 max-w-2xl text-[14px] text-white/70">{role.tagline}. {role.blurb}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <InfoCard icon={CreditCard} title="Application fee" body={`${role.fee} — ${role.feeNote}`} />
              <InfoCard icon={FileSignature} title="Agreement" body={role.agreement} />
              <InfoCard icon={LayoutDashboard} title="Dashboard access" body={role.dashboard} />
            </div>

            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-white/60">
                <span>Approval workflow</span>
                <span>{progress}% complete</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <ol className="mt-3 flex flex-wrap gap-2">
                {role.workflow.map((w, i) => (
                  <li
                    key={w}
                    className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] text-white/70"
                  >
                    <span className="mr-1 font-bold text-cyan-300">{i + 1}.</span>
                    {w}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </header>

        <form onSubmit={submit} className="mt-8 space-y-6">
          {role.sections.map((section, si) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6"
            >
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-gradient-to-br from-cyan-400/25 to-amber-300/20 text-[12px] font-black text-cyan-200">
                  {si + 1}
                </span>
                <div>
                  <h2 className="text-[15px] font-bold">{section.title}</h2>
                  {section.note && <p className="text-[11.5px] text-white/50">{section.note}</p>}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((f) => (
                  <FieldInput
                    key={f.name}
                    field={f}
                    value={values[f.name] ?? ""}
                    onChange={(v) => set(f.name, v)}
                    onFile={(file, input) => pickFile(f, file, input)}
                    hint={t("apply.document_hint")}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
            <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-300" /> Agreement Acceptance
            </h2>
            <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-[12.5px] leading-relaxed text-white/65">
              {role.agreement}
            </p>
            <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[12.5px] text-white/80">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-cyan-400"
              />
              I have read and accept the agreement, and confirm all submitted information is accurate.
            </label>
          </section>

          <section className="rounded-2xl border border-white/12 bg-white/[0.04] p-5 backdrop-blur-xl sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold">
              <CreditCard className="h-4 w-4 text-amber-300" /> Application Fee
            </h2>
            <p className="text-[12.5px] text-white/60">{role.feeNote}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-[15px] font-black text-amber-200">
                {role.fee}
              </span>
              <span className="text-[12px] text-white/55" data-no-online-payment>
                {t("apply.no_payment")}
              </span>
            </div>
          </section>

          {!acceptsOnline && (
            <p
              className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-[13px] text-amber-100"
              data-application-not-open
            >
              {t("apply.not_open")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || !acceptsOnline}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-7 py-3 text-[14px] font-black disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Application
            </button>
            <Link to="/" className="rounded-full border border-white/20 bg-white/5 px-6 py-3 text-[13px] font-bold">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.05] p-3.5">
      <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-white/70">
        <Icon className="h-3.5 w-3.5 text-cyan-300" /> {title}
      </div>
      <p className="mt-1.5 text-[11.5px] leading-snug text-white/55">{body}</p>
    </div>
  );
}
