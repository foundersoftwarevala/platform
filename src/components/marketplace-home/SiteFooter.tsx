import type { ReactElement } from "react";
import { Facebook, Globe, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";

import { useHomeRouteMatch } from "@/lib/marketplace/home-route-data";
import { SITE_STATS } from "@/lib/site-content/constants";
import { useTranslation } from "@/lib/i18n/use-translation";
import { phrase, type HomeStats } from "@/lib/marketplace/home-stats";
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
      // The FAQ section renders as id="faq", and it renders on /marketplace -
      // not on /. "/#faq" therefore landed on a homepage with no such anchor
      // and did nothing at all; checked against the served HTML, id="faq"
      // appears once on /marketplace and zero times on /. The earlier fix took
      // this from "/#faq-faq-1" to "/#faq" and stopped one step short.
      { label: "Frequently asked questions", href: "/marketplace#faq" },
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
      // /support is the Support Operations Center, an operator console behind a
      // role gate, so this link showed a customer "Access restricted" on the
      // one page in the footer they were most likely to need. /contact is the
      // customer's way in; it writes to the same support_tickets table that
      // console reads, so nothing is duplicated and /support is unchanged.
      { label: "Contact support", href: "/contact" },
      { label: "Sales assistant", href: "/ai/assistant" },
      { label: "Sign in", href: "/login" },
      { label: "Your purchases", href: "/account/purchases" },
      { label: "WhatsApp +91 83488 38383", href: "https://wa.me/918348838383" },
      { label: "hellosoftwarevala@gmail.com", href: "mailto:hellosoftwarevala@gmail.com" },
      // "Offline software — ErpVala" → https://erpvala.com was here and is
      // gone. The domain does not resolve — curl answers "(6) Could not
      // resolve host" over both http and https — and it was never anybody's
      // decision: the row it mirrors has created_by null and a created_at
      // identical to the rest of 20260907040000_storefront_chrome_seed.sql.
      // A generator put a placeholder domain on every public page.
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy policy", href: "/legal/privacy-policy" },
      { label: "Terms of service", href: "/legal/terms-of-service" },
      { label: "Refund policy", href: "/legal/refund-policy" },
    ],
  },
];

/**
 * WhatsApp's glyph, because lucide-react does not carry it.
 *
 * Drawn rather than imported so the footer gains no dependency for one icon,
 * and drawn as a path rather than fetched so it cannot fail to load.
 */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.19-.31a8.19 8.19 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.81 2.41a8.16 8.16 0 0 1 2.41 5.83c0 4.54-3.7 8.21-8.24 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.41-.56-.42h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.57.12.17 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.6.19 1.14.16 1.57.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.08.14-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

/**
 * The icon and colour a social profile is recognised by.
 *
 * The footer listed the profiles as plain cyan words, which read as four more
 * links in a page full of links. A visitor scanning for "where are they on
 * Instagram" looks for the glyph, not the word, so each profile now carries its
 * own mark in its own colour, with the name kept beside it rather than replaced
 * by it - an icon alone is a guess, and a screen reader needs the name.
 *
 * Matched on the platform name the business recorded, so a profile added later
 * still gets something sensible rather than nothing.
 */
function brandOf(label: string): {
  Icon: (props: { className?: string }) => ReactElement;
  className: string;
} {
  const name = label.toLowerCase();
  if (name.includes("facebook")) {
    return {
      Icon: (p) => <Facebook {...p} />,
      className: "border-blue-400/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 focus-visible:outline-blue-400",
    };
  }
  if (name.includes("instagram")) {
    return {
      Icon: (p) => <Instagram {...p} />,
      className: "border-pink-400/40 bg-pink-500/10 text-pink-200 hover:bg-pink-500/20 focus-visible:outline-pink-400",
    };
  }
  if (name.includes("youtube")) {
    return {
      Icon: (p) => <Youtube {...p} />,
      className: "border-red-400/40 bg-red-500/10 text-red-200 hover:bg-red-500/20 focus-visible:outline-red-400",
    };
  }
  if (name.includes("whatsapp")) {
    return {
      Icon: (p) => <WhatsAppGlyph {...p} />,
      className: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 focus-visible:outline-emerald-400",
    };
  }
  if (name.includes("linkedin")) {
    return {
      Icon: (p) => <Linkedin {...p} />,
      className: "border-sky-400/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20 focus-visible:outline-sky-400",
    };
  }
  if (name.includes("twitter") || name === "x") {
    return {
      Icon: (p) => <Twitter {...p} />,
      className: "border-white/25 bg-white/10 text-white hover:bg-white/20 focus-visible:outline-white",
    };
  }
  return {
    Icon: (p) => <Globe {...p} />,
    className: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 focus-visible:outline-cyan-400",
  };
}

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
  const home = useHomeRouteMatch();
  const chrome = (home?.loaderData as { chrome?: { footer?: FooterSnapshot } } | undefined)?.chrome;
  const footer = chrome?.footer;
  return footer?.published ? footer : null;
}

/**
 * The catalogue counts for the footer line, counted by the database.
 *
 * SITE_STATS stays as the fallback, so a footer drawn on a route without the
 * home loader - or one whose count failed - renders exactly what it rendered
 * before rather than a blank or a zero.
 */
function useFooterStats() {
  const home = useHomeRouteMatch();
  const stats = (home?.loaderData as { stats?: HomeStats | null } | undefined)?.stats;
  return {
    solutions: stats ? phrase(stats.products) : SITE_STATS.solutions,
    categories: stats ? String(stats.categories) : SITE_STATS.categories,
  };
}

export const SiteFooter = () => {
  const { t } = useTranslation();
  const published = usePublishedFooter();
  const { solutions: liveSolutions, categories: liveCategories } = useFooterStats();

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

        <div className="mt-10 border-t border-white/10 pt-6">
          <h2 className="text-center text-[11px] font-bold uppercase tracking-wider text-cyan-300">
            Follow us
          </h2>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
            {socials.map((profile) => {
              const brand = brandOf(profile.label);
              return (
                <a
                  key={profile.label}
                  href={profile.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  title={profile.handle ? `${profile.label} — ${profile.handle}` : profile.label}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${brand.className}`}
                >
                  <brand.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{profile.label}</span>
                  {profile.handle && (
                    <span className="hidden text-[11px] font-normal opacity-70 sm:inline">
                      {profile.handle}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
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
          {t("marketplace.footer.no_advance_payment")}
        </p>

        <div className="mt-4 border-t border-white/10 pt-6 text-center">
          <p className="text-gray-400">
            © {new Date().getFullYear()} Software Vala™ - The Name of Trust. All rights reserved.
          </p>
          <p className="mt-2 text-cyan-400">
            {liveCategories} Master Categories • {liveSolutions} Software Solutions • Live Demos Ready
          </p>
        </div>
      </div>
    </footer>
  );
};
