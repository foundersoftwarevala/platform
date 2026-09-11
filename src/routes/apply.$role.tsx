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
import { submitApplication } from "@/lib/applications/store";
import { SUPPORT_WHATSAPP_URL, supportMailto } from "@/lib/portal/config";

export const Route = createFileRoute("/apply/$role")({
  head: ({ params }) => {
    const role = getRole(params.role);
    const title = role ? `${role.label} — Software Vala Application` : "Apply — Software Vala";
    const description = role
      ? `${role.tagline}. Complete the ${role.label.replace("Become ", "")} application form, accept the agreement and submit for approval.`
      : "Choose a role and apply to join the Software Vala marketplace.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
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
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
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
        <input
          id={id}
          type="file"
          onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
          className={`${inputCls} file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-400/20 file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-cyan-100`}
        />
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
  const { role: roleKey } = Route.useParams();
  const role = getRole(roleKey);
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  // There is no "paid" state any more. "Pay Now" used to set one in the
  // browser and announce "Payment recorded" with no money having moved; the
  // flag then travelled with the application as if the fee were settled. No
  // payment path exists for application fees, so nothing here may claim one.
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const freeFee = role?.fee.toLowerCase() === "free";

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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) {
      toast.error("Please accept the agreement to continue.");
      return;
    }
    setBusy(true);
    window.setTimeout(() => {
      // Kept exactly as it was: the application is saved in this browser, and
      // that is all submitApplication does. There is no server intake and no
      // Control Panel approval queue behind this form yet (see store.ts), so
      // the page no longer says it was "sent to the boss panel". It says what
      // happened and gives the applicant the real way to reach the team.
      submitApplication({
        role: role.key,
        roleLabel: role.label,
        applicant: values["fullName"] || "Unnamed applicant",
        email: values["email"] || "",
        phone: values["phone"] || "",
        fee: role.fee,
        // Only a free application is settled; a fee is arranged after approval.
        paid: freeFee,
        values,
      });
      setBusy(false);
      setDone(true);
      toast.success("Application saved. Send it to our team to start the review.");
    }, 700);
  };

  /**
   * The application as plain text, for the email the applicant sends.
   *
   * Every field the form asked for, by its own label. A file field only ever
   * held the file's name - the file itself never left the browser - so it is
   * marked as something to attach rather than passed off as sent.
   */
  const summary = () => {
    const lines = [`Role: ${role.label}`, `Application fee: ${role.fee}`, ""];
    for (const section of role.sections) {
      lines.push(`# ${section.title}`);
      for (const field of section.fields) {
        const value = (values[field.name] ?? "").trim();
        if (!value) continue;
        lines.push(`${field.label}: ${value}${field.type === "file" ? " (please attach this file)" : ""}`);
      }
      lines.push("");
    }
    lines.push("Agreement accepted: yes");
    // Mail clients refuse very long mailto: addresses; the essentials come first.
    return lines.join("\n").slice(0, 1800);
  };
  const applicantName = values["fullName"] || "Applicant";
  const emailHref = supportMailto(`${role.label} application — ${applicantName}`, summary());
  const whatsappHref = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(
    `Hello, I have filled in the ${role.label.replace("Become ", "")} application on Software Vala. Name: ${applicantName}. Email: ${values["email"] || "-"}.`,
  )}`;

  if (done) {
    return (
      <div className="mpc-home min-h-screen px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/12 bg-white/[0.05] p-8 text-center backdrop-blur-xl">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-300" />
          <h1 className="mt-4 text-2xl font-black">Application ready — one step left</h1>
          {/* This used to say the application was pending approval and that the
              admin team had been notified. Neither was true: it was saved in
              this browser only, where no reviewer can see it. The applicant is
              now told that plainly and given the two routes that do reach a
              person - the support inbox, carrying the whole application, and
              WhatsApp. Approval is given by the boss in the Control Panel; any
              fee is arranged with the applicant only after that. */}
          <p className="mt-2 text-[13.5px] leading-relaxed text-white/65">
            Your {role.label.replace("Become ", "")} application is saved on this device. Send it to our team to start
            the review — the email below already contains everything you filled in. Approval is decided by the Software
            Vala team{freeFee ? "" : `, and the ${role.fee} fee is arranged with you only after your application is approved`}.
            We will reply on {values["email"] || "your email"}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a
              href={emailHref}
              className="rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-5 py-2.5 text-[13px] font-bold"
            >
              Email my application
            </a>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-emerald-300/40 bg-emerald-400/15 px-5 py-2.5 text-[13px] font-bold text-emerald-200"
            >
              WhatsApp our team
            </a>
            <Link
              to="/control-panel"
              className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[13px] font-bold"
            >
              Control Panel (staff only)
            </Link>
            <Link to="/" className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-[13px] font-bold">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mpc-home min-h-screen px-4 pb-20 pt-8 sm:px-6">
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
                  <FieldInput key={f.name} field={f} value={values[f.name] ?? ""} onChange={(v) => set(f.name, v)} />
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
              {!freeFee && (
                // "Pay Now" marked the fee paid in this browser and toasted
                // "Payment recorded" while no money moved. There is no payment
                // path for application fees, and the owner's rule is that a
                // payment is never faked, so the button now says what actually
                // happens: nothing is charged here, and the fee is arranged
                // after the application is approved.
                <button
                  type="button"
                  onClick={() => {
                    toast.info("No payment is taken on this page. The fee is arranged with you after your application is approved.", { id: "application-fee" });
                  }}
                  className="rounded-full bg-gradient-to-r from-amber-300 to-orange-500 px-5 py-2.5 text-[13px] font-bold text-[#2a1704]"
                >
                  Pay after approval
                </button>
              )}
            </div>
            {!freeFee && (
              <p className="mt-3 text-[11.5px] text-white/50">
                Nothing is charged when you submit. Once your application is approved, our team sends you the payment
                details for the {role.fee} fee.
              </p>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
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
