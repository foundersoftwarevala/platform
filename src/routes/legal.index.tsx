import { createFileRoute } from "@tanstack/react-router";

import softwareValaLogo from "@/assets/software-vala-logo.jpg";
import { SiteFooter } from "@/components/marketplace-home/SiteFooter";
import { listLegalPolicies } from "@/lib/storefront/legal.functions";
import { absoluteUrl } from "@/lib/seo/site-url";
import "@/styles/marketplace-home.css";

/**
 * The index of published legal pages.
 *
 * It lists whatever the Legal Manager has published and nothing else, so a
 * policy withdrawn there disappears from here without a deploy, and a new one
 * appears the moment it is published.
 */

function LegalIndex() {
  const policies = Route.useLoaderData();

  return (
    <div className="sv-wide min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0d1e36] to-[#0a1628]">
      <header className="bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 px-4 py-4 shadow-2xl">
        <div className="mx-auto max-w-7xl">
          <a href="/" className="flex w-fit items-center gap-4">
            <img
              src={softwareValaLogo}
              alt="Software Vala"
              className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-white">Software Vala&trade;</h1>
              <p className="text-sm text-white/90">- The Name of Trust</p>
            </div>
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="text-2xl font-bold text-white">Legal</h2>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          How we work, what we are responsible for, and what we are not. Written to be read.
        </p>

        {policies.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-6 text-sm text-gray-400">
            Nothing is published yet.
          </p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policies.map((policy) => (
              <li key={policy.slug}>
                <a
                  href={`/legal/${policy.slug}`}
                  className="block h-full rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-5 transition-colors hover:border-cyan-400/40 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <h3 className="text-base font-bold text-white">{policy.name}</h3>
                  <p className="mt-2 text-[13px] text-gray-400">
                    Version {policy.version}
                    {policy.last_updated ? ` · updated ${policy.last_updated}` : ""}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-[13px] text-gray-400">
          Something here unclear? Write to{" "}
          <a className="text-cyan-300 hover:text-cyan-200" href="mailto:hellosoftwarevala@gmail.com">
            hellosoftwarevala@gmail.com
          </a>{" "}
          or use{" "}
          <a className="text-cyan-300 hover:text-cyan-200" href="/contact">
            the contact page
          </a>
          .
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/legal/")({
  loader: async () => listLegalPolicies(),
  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/legal") }],
    meta: [
      { title: "Legal | Software Vala" },
      {
        name: "description",
        content:
          "Software Vala's privacy policy, terms of service and refund policy - how we work, what we are responsible for, and what we are not.",
      },
      { property: "og:title", content: "Legal | Software Vala" },
    ],
  }),
  component: LegalIndex,
});
