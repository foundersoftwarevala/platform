import { SITE_STATS } from "@/lib/site-content/constants";

/**
 * The storefront footer.
 *
 * Every link here points at a route that exists — the catalogue, the four
 * marketplace tools, Vala TV, the Academy, each partner application and
 * support. Nothing is listed that would open a page we do not have, and no
 * social profile is shown because none is configured. Legal pages (terms,
 * privacy, refunds) are deliberately absent rather than invented: they have to
 * be written by the business before they can be linked.
 *
 * The original copyright line and catalogue summary are kept exactly as they
 * were, with the year now taken from the clock instead of being fixed.
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

export const SiteFooter = () => (
  <footer className="border-t border-cyan-500/20 bg-[#0a1628] px-4 py-10">
    <div className="mx-auto max-w-7xl">
      <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {COLUMNS.map((column) => (
          <div key={column.heading}>
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              {column.heading}
            </h2>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
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

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-white/10 pt-6">
        {SOCIAL.map((profile) => (
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
