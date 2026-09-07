import { useMatch } from "@tanstack/react-router";
import { SITE_STATS } from "@/lib/site-content/constants";
import type { FooterSnapshot } from "@/lib/storefront/chrome.functions";

/**
 * The storefront footer.
 *
 * What it shows now comes from the Footer Manager: one published snapshot,
 * resolved on the server and delivered with the page, so there is a single
 * canonical footer configuration rather than a copy of the links kept here and
 * another kept in the manager.
 *
 * The arrays below are no longer the source of truth, but they are not
 * decoration either. They are what renders when the snapshot cannot be read, or
 * before anything has ever been published, and they are exactly what the site
 * shipped before the footer became editable. A footer is on every page; losing
 * it to a failed configuration lookup would be worse than showing a slightly
 * old one.
 *
 * The seeded snapshot is these links, link for link, so making the footer
 * database-driven changed nothing a visitor could see.
 *
 * Every link here points at a route that exists — the catalogue, the four
 * marketplace tools, Vala TV, the Academy, each partner application and
 * support. Nothing is listed that would open a page we do not have, and only
 * social profiles the business actually runs are shown. Legal pages (terms,
 * privacy, refunds) are deliberately absent rather than invented: they have to
 * be written and published in the Legal Manager before they can be linked, and
 * the manager will carry them the moment they are.
 */

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Marketplace",
    links: [
      { label: "Browse all software", href: "/marketplace" },
      { label: "AI Product Finder", href: "/ai/finder" },
      { label: "Recommendations", href: "/ai/recommend" },
      { label: "Compare products", href: "/ai/compare" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Vala TV", href: "/vala-tv" },
      { label: "Vala Academy", href: "/academy" },
      { label: "Frequently asked questions", href: "/#faq-faq-1" },
    ],
  },
  {
    heading: "Partners",
    links: [
      { label: "Become a reseller", href: "/apply/reseller" },
      { label: "Become a vendor", href: "/apply/vendor" },
      { label: "Franchise partner", href: "/apply/franchise" },
      { label: "Publish as an author", href: "/apply/author" },
      { label: "Affiliate programme", href: "/apply/affiliate" },
      { label: "All partner programmes", href: "/apply" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Contact support", href: "/support" },
      { label: "Sales assistant", href: "/ai/assistant" },
      { label: "Sign in", href: "/login" },
      { label: "Your purchases", href: "/account/purchases" },
      { label: "WhatsApp +91 83488 38383", href: "https://wa.me/918348838383" },
      { label: "hellosoftwarevala@gmail.com", href: "mailto:hellosoftwarevala@gmail.com" },
      { label: "Offline software — ErpVala", href: "https://erpvala.com" },
    ],
  },
];

/** Published company profiles. Only accounts the business actually runs. */
const SOCIAL = [
  { label: "Facebook", href: "https://facebook.com/share/1HpGSvExis" },
  { label: "Instagram", href: "https://instagram.com/new_software_vala" },
  { label: "WhatsApp", href: "https://wa.me/918348838383" },
  { label: "YouTube", href: "https://youtube.com/@softwarevala" },
];

/**
 * The published footer, if the page was given one.
 *
 * This component is drawn on routes that do not carry the home loader, so the
 * match is requested without throwing and its absence simply means "use what
 * the file ships with".
 */
function usePublishedFooter(): FooterSnapshot | null {
  const home = useMatch({ from: "/", shouldThrow: false });
  const chrome = (home?.loaderData as { chrome?: { footer?: FooterSnapshot } } | undefined)?.chrome;
  const footer = chrome?.footer;
  return footer?.published ? footer : null;
}

export const SiteFooter = () => {
  const published = usePublishedFooter();

  // A published footer with no column at all would empty the page, so the
  // built-in columns still stand behind it.
  const columns =
    published?.columns?.length
      ? published.columns.map((c) => ({
          heading: c.heading,
          links: (c.links ?? [])
            .filter((l) => Boolean(l?.href))
            .map((l) => ({
              label: l.label,
              href: l.href as string,
              openInNew: Boolean(l.open_in_new),
            })),
        }))
      : COLUMNS.map((c) => ({
          heading: c.heading,
          links: c.links.map((l) => ({ ...l, openInNew: false })),
        }));

  const socials = published?.socials?.length ? published.socials : SOCIAL;
  const newsletter = published?.newsletter;
  const trust = published?.trust ?? [];

  // Section 32. The footer may be switched off, but never on the page that
  // carries the company's contact and legal routes — so hiding it removes the
  // link columns and keeps the identity and contact block below.
  const showColumns = published ? published.show_footer !== false : true;

  return (
    <footer className="border-t border-cyan-500/20 bg-[#0a1628] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        {showColumns && (
          <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((column) => (
              <div key={column.heading}>
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                  {column.heading}
                </h2>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={`${column.heading}-${link.href}-${link.label}`}>
                      <a
                        href={link.href}
                        {...(link.openInNew
                          ? { target: "_blank", rel: "noopener noreferrer" }
                          : {})}
                        className="text-[13px] text-gray-400 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        )}

        {newsletter?.enabled && (
          <section
            aria-labelledby="footer-newsletter"
            className="mt-10 border-t border-white/10 pt-6"
          >
            <h2 id="footer-newsletter" className="text-sm font-bold text-white">
              {newsletter.title}
            </h2>
            {newsletter.description && (
              <p className="mt-1 text-[13px] text-gray-400">{newsletter.description}</p>
            )}
            {/* Only rendered when a provider is configured — the snapshot sets
                `enabled` false otherwise, so the storefront never collects an
                address it has nowhere to store. */}
            <form
              className="mt-3 flex max-w-md flex-wrap gap-2"
              action="/api/marketplace/lead"
              method="post"
            >
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                name="email"
                required
                placeholder={newsletter.placeholder}
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-[13px] text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              />
              <button
                type="submit"
                className="rounded-lg border border-cyan-400/40 bg-cyan-500/15 px-4 py-2 text-[13px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                Subscribe
              </button>
            </form>
            {newsletter.consent && (
              <p className="mt-2 text-[11px] text-gray-500">{newsletter.consent}</p>
            )}
          </section>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-6">
          {socials.map((profile) => (
            <a
              key={profile.label}
              href={profile.href}
              target="_blank"
              rel="noopener noreferrer me"
              className="text-[13px] font-semibold text-cyan-300 transition-colors hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              {profile.label}
            </a>
          ))}
        </div>

        {trust.length > 0 && (
          <ul
            aria-label="Payment and security"
            className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-white/10 pt-6"
          >
            {trust.map((item) => (
              <li key={`${item.kind}-${item.name}`}>
                {item.icon ? (
                  <img src={item.icon} alt={item.alt} className="h-6 w-auto" loading="lazy" />
                ) : (
                  <span
                    className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] font-semibold text-gray-300"
                    title={item.alt}
                  >
                    {item.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-center text-[13px] font-semibold text-white/80">
          No advance payment — you see the demo first.
        </p>

        <div className="mt-4 border-t border-white/10 pt-6 text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} Software Vala - The Name of Trust. All rights reserved.
          </p>
          <p className="mt-2 text-cyan-400">
            {SITE_STATS.categories} Master Categories • {SITE_STATS.solutions} Software Solutions • Live Demos Ready
          </p>
        </div>
      </div>
    </footer>
  );
};
