import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import softwareValaLogo from "@/assets/software-vala-logo.jpg";
import { SiteFooter } from "@/components/marketplace-home/SiteFooter";
import { absoluteUrl } from "@/lib/seo/site-url";
import "@/styles/marketplace-home.css";

/**
 * How a customer reaches us.
 *
 * The footer's "Contact support" used to point at /support, which is the
 * Support Operations Center - an operator console behind a role gate - so a
 * customer following that link from the public site was shown "Access
 * restricted". /support stays exactly as it is; this is the page the customer
 * link belongs on.
 *
 * It writes to the same support_tickets table the console reads, through
 * /api/marketplace/contact, so a message raised here is the same kind of
 * record an agent already works from. No second support system is introduced.
 *
 * The page shell is the storefront's own - the same header and the published
 * SiteFooter the marketplace uses - rather than a new design.
 */

const CATEGORIES: { value: string; label: string }[] = [
  { value: "general", label: "General question" },
  { value: "order", label: "An order I placed" },
  { value: "billing", label: "Billing or payment" },
  { value: "licence", label: "Licence or activation" },
  { value: "technical", label: "Technical problem" },
  { value: "demo", label: "A demo I am trying" },
  { value: "partnership", label: "Partnership or reselling" },
];

type Sent = { reference: string; emailSent: boolean };

function ContactPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/marketplace/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          category: form.get("category"),
          subject: form.get("subject"),
          message: form.get("message"),
          sourcePage: typeof window === "undefined" ? null : window.location.pathname,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        reference?: string;
        emailSent?: boolean;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error ?? "We could not record your message.");
      } else {
        setSent({ reference: payload.reference ?? "", emailSent: Boolean(payload.emailSent) });
      }
    } catch {
      setError("We could not reach the server. Please WhatsApp us on +91 83488 38383.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400";
  const label = "block text-[13px] font-semibold text-cyan-200";

  return (
    <div className="sv-wide min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1e36] to-[#0a1628]">
      <header className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 py-4 px-4 shadow-2xl">
        <div className="max-w-7xl mx-auto">
          <a href="/" className="flex items-center gap-4 w-fit">
            <img
              src={softwareValaLogo}
              alt="Software Vala"
              className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-lg"
            />
            <div>
              <h1 className="text-white font-bold text-2xl">Software Vala&trade;</h1>
              <p className="text-white/90 text-sm">- The Name of Trust</p>
            </div>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="text-2xl font-bold text-white">Contact support</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Tell us what you need and we will reply by email. Every message is logged with a
          reference so you can quote it when you write again.
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-5 sm:p-6">
            {sent ? (
              <div>
                <h3 className="text-lg font-bold text-white">Your message is with us</h3>
                <p className="mt-2 text-sm text-gray-300">
                  Your reference is{" "}
                  <strong className="text-cyan-300">{sent.reference}</strong>. Please quote it if
                  you write to us again about this.
                </p>
                <p className="mt-3 text-[13px] text-gray-400">
                  {sent.emailSent
                    ? "A copy has been emailed to you."
                    : "Your copy is queued and will be emailed as soon as our mail provider is connected - the message itself is already recorded."}
                </p>
                <a
                  href="/marketplace"
                  className="mt-5 inline-block rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-[13px] font-semibold text-cyan-200 hover:bg-cyan-500/25"
                >
                  Back to the marketplace
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="contact-name">
                      Your name
                    </label>
                    <input
                      id="contact-name"
                      name="name"
                      required
                      maxLength={120}
                      className={`mt-1 ${field}`}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="contact-email">
                      Email we should reply to
                    </label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      required
                      maxLength={200}
                      className={`mt-1 ${field}`}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label} htmlFor="contact-phone">
                      Phone or WhatsApp{" "}
                      <span className="font-normal text-gray-500">(optional)</span>
                    </label>
                    <input
                      id="contact-phone"
                      name="phone"
                      maxLength={40}
                      className={`mt-1 ${field}`}
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="contact-category">
                      What is it about
                    </label>
                    <select
                      id="contact-category"
                      name="category"
                      defaultValue="general"
                      className={`mt-1 ${field}`}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value} className="bg-[#0d1e36]">
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={label} htmlFor="contact-subject">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    name="subject"
                    maxLength={200}
                    className={`mt-1 ${field}`}
                  />
                </div>

                <div>
                  <label className={label} htmlFor="contact-message">
                    How can we help
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    required
                    rows={6}
                    maxLength={5000}
                    className={`mt-1 ${field}`}
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[13px] text-red-200"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="justify-self-start rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25 disabled:opacity-60"
                >
                  {busy ? "Sending..." : "Send message"}
                </button>
              </form>
            )}
          </section>

          <aside className="rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              Other ways to reach us
            </h3>
            <ul className="mt-3 space-y-3 text-[13px]">
              <li>
                <a className="text-gray-300 hover:text-white" href="https://wa.me/918348838383">
                  WhatsApp +91 83488 38383
                </a>
              </li>
              <li>
                <a
                  className="text-gray-300 hover:text-white"
                  href="mailto:hellosoftwarevala@gmail.com"
                >
                  hellosoftwarevala@gmail.com
                </a>
              </li>
              <li>
                <a className="text-gray-300 hover:text-white" href="/#faq">
                  Frequently asked questions
                </a>
              </li>
              <li>
                <a className="text-gray-300 hover:text-white" href="/ai/assistant">
                  Ask the sales assistant
                </a>
              </li>
              <li>
                <a className="text-gray-300 hover:text-white" href="/account/purchases">
                  Your purchases
                </a>
              </li>
            </ul>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/contact")({
  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/contact") }],
    meta: [
      { title: "Contact support | Software Vala" },
      {
        name: "description",
        content:
          "Write to the Software Vala support team about an order, a licence, billing or a technical problem, and get a reference for your request.",
      },
      { property: "og:title", content: "Contact support | Software Vala" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ContactPage,
});
