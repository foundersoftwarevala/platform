import { createFileRoute, notFound } from "@tanstack/react-router";

import softwareValaLogo from "@/assets/software-vala-logo.jpg";
import PolicyText from "@/components/marketplace-home/PolicyText";
import { SiteFooter } from "@/components/marketplace-home/SiteFooter";
import { getLegalPolicy, listLegalPolicies } from "@/lib/storefront/legal.functions";
import { absoluteUrl } from "@/lib/seo/site-url";
import "@/styles/marketplace-home.css";

/**
 * One published legal page.
 *
 * /terms, /privacy, /legal and /refund-policy answered 404 from the day the
 * site went up, and the footer carried no Legal column, because sf_legal_href()
 * had nothing published to resolve to. The policies are ordinary Legal Manager
 * records now, so the owner edits their wording there and it reaches this page
 * without a deploy.
 *
 * The shell is the storefront's own - the same header and the published
 * SiteFooter the marketplace uses - so a reader who followed a footer link does
 * not land somewhere that looks like a different site.
 */

function LegalPage() {
  const { policy, others } = Route.useLoaderData();

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
        <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <article className="rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-5 sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              Version {policy.version}
              {policy.last_updated ? ` · updated ${policy.last_updated}` : ""}
            </p>
            <PolicyText content={policy.content} />
          </article>

          <aside className="lg:sticky lg:top-6 lg:self-start">
            <nav
              aria-label="Legal"
              className="rounded-2xl border border-cyan-500/20 bg-white/[0.03] p-5"
            >
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                Legal
              </h2>
              <ul className="mt-3 space-y-2 text-[13px]">
                {others.map((item) => (
                  <li key={item.slug}>
                    <a
                      href={`/legal/${item.slug}`}
                      aria-current={item.slug === policy.slug ? "page" : undefined}
                      className={
                        item.slug === policy.slug
                          ? "font-semibold text-white"
                          : "text-gray-400 transition-colors hover:text-white"
                      }
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-white/10 pt-4 text-[13px] text-gray-400">
                Something here unclear? Write to us at{" "}
                <a
                  className="text-cyan-300 hover:text-cyan-200"
                  href="mailto:hellosoftwarevala@gmail.com"
                >
                  hellosoftwarevala@gmail.com
                </a>{" "}
                or through{" "}
                <a className="text-cyan-300 hover:text-cyan-200" href="/contact">
                  our contact page
                </a>
                .
              </p>
            </nav>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/legal/$slug")({
  loader: async ({ params }) => {
    const [policy, others] = await Promise.all([
      getLegalPolicy({ data: params.slug }),
      listLegalPolicies(),
    ]);
    // An unpublished or unknown policy is a missing page, not an empty one.
    if (!policy) throw notFound();
    return { policy, others };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.policy?.name ?? "Legal";
    return {
      links: [
        { rel: "canonical", href: absoluteUrl(`/legal/${loaderData?.policy?.slug ?? ""}`) },
      ],
      meta: [
        { title: `${name} | Software Vala` },
        {
          name: "description",
          content: `${name} for Software Vala - how we work, what we are responsible for, and what we are not.`,
        },
        { property: "og:title", content: `${name} | Software Vala` },
        { property: "og:type", content: "article" },
      ],
    };
  },
  component: LegalPage,
});
