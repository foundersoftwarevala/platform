/**
 * How the partner programmes are described to search engines and to social
 * platforms.
 *
 * The owner's ask: someone looking for a business opportunity should find
 * Software Vala, and an influencer anywhere in the world should see something
 * worth sharing, so that these people become authorised partners.
 *
 * The /apply pages carried a title, a description and og:type and nothing else -
 * no keywords, no image, no hashtags, no structured data - so a page whose whole
 * job is to be found by someone searching "software reseller opportunity India"
 * gave a search engine almost nothing to match on.
 *
 * Two rules this file keeps.
 *
 * Nothing is claimed that is not true. There are no earnings figures, no partner
 * counts, no "India's #1", no ratings, and no structured data that pretends to be
 * a job posting with a salary - Google treats a fabricated JobPosting as a
 * violation, and the owner's standing rule forbids invented business numbers
 * anyway. What is described is the offer itself: what the partner does, what they
 * get, and that the platform takes no advance payment.
 *
 * The hashtags are data, not decoration. They live here so the same set is used
 * by the page's social tags and by anything that publishes on the business's
 * behalf, rather than being retyped differently in each place.
 */

export type PartnerSeo = {
  /** Search phrases a person with this intent actually types. */
  keywords: string[];
  /** Hashtags for a post about this programme, most specific first. */
  hashtags: string[];
  /** One sentence for a social card. Written to be read by a person. */
  share: string;
  /** What this partner does, for structured data. */
  offer: string;
};

/**
 * Tags every partner post carries, whatever the role.
 *
 * Kept short on purpose: a wall of hashtags reads as spam and platforms
 * de-rank it. These are the ones that identify the business and the sector.
 */
export const PARTNER_BASE_HASHTAGS = [
  "#SoftwareVala",
  "#BusinessOpportunity",
  "#SoftwareBusiness",
  "#B2BSoftware",
] as const;

const PARTNERS: Record<string, PartnerSeo> = {
  reseller: {
    keywords: [
      "software reseller opportunity",
      "become a software reseller",
      "software reseller programme India",
      "white label software reseller",
      "sell business software and keep the margin",
      "software distributor opportunity",
      "IT reseller partner programme",
      "start a software reselling business",
    ],
    hashtags: ["#ResellerProgram", "#WhiteLabel", "#SoftwareReseller", "#ChannelPartner"],
    share:
      "Resell business software and keep the margin. You show the demo, we build and deliver, and the customer pays only after they have verified it.",
    offer: "Resell the Software Vala catalogue under a reseller agreement and keep the margin on each sale.",
  },
  franchise: {
    keywords: [
      "software franchise opportunity",
      "IT franchise India",
      "software company franchise",
      "low investment software franchise",
      "run a software business in your city",
      "technology franchise opportunity",
      "software franchise partner",
    ],
    hashtags: ["#FranchiseOpportunity", "#SoftwareFranchise", "#Franchise", "#OwnYourBusiness"],
    share:
      "Run Software Vala in your city. The catalogue, the demos and the delivery are ours; the local business is yours.",
    offer: "Operate Software Vala in an assigned territory under a franchise agreement.",
  },
  affiliate: {
    keywords: [
      "software affiliate programme",
      "B2B software affiliate",
      "earn commission referring software",
      "SaaS affiliate programme India",
      "software referral programme",
      "affiliate marketing software niche",
    ],
    hashtags: ["#AffiliateProgram", "#AffiliateMarketing", "#ReferAndEarn", "#PassiveIncome"],
    share:
      "Refer a business that needs software and earn commission on the sale. Nothing is asked of your audience up front — they see the demo first.",
    offer: "Earn commission on each sale made through your referral, under an affiliate agreement.",
  },
  influencer: {
    keywords: [
      "influencer collaboration software brand",
      "tech influencer partnership",
      "creator partnership B2B software",
      "paid collaboration software company",
      "influencer programme India technology",
      "software brand ambassador programme",
      "YouTube creator software partnership",
    ],
    hashtags: ["#CreatorPartnership", "#InfluencerCollab", "#TechCreator", "#BrandPartner"],
    share:
      "Work with Software Vala as a creator. Real products, live demos your audience can open themselves, and nothing they have to pay before they have seen it.",
    offer: "Collaborate as a creator or influencer under an agreed partnership.",
  },
  vendor: {
    keywords: [
      "sell my software online",
      "software marketplace for vendors",
      "list software product for sale",
      "software vendor programme",
      "sell SaaS product marketplace",
      "software publisher opportunity",
    ],
    hashtags: ["#VendorProgram", "#SellYourSoftware", "#SoftwareMarketplace", "#IndieDev"],
    share:
      "List your software on Software Vala. Every submission is verified before it goes live, and you are paid within seven days of verification.",
    offer: "List and sell your own software products through the Software Vala marketplace.",
  },
  author: {
    keywords: [
      "publish software as an author",
      "sell source code online",
      "software author programme",
      "publish and sell your code",
      "developer marketplace for authors",
      "earn from your software project",
    ],
    hashtags: ["#PublishYourCode", "#DeveloperIncome", "#SourceCode", "#BuildAndSell"],
    share:
      "Publish your work through Software Vala. Verified before it is listed, paid within seven days of verification.",
    offer: "Publish software as an author and be paid after verification.",
  },
  employee: {
    keywords: [
      "software company careers India",
      "work at Software Vala",
      "software jobs marketplace company",
      "join a software factory team",
    ],
    hashtags: ["#Hiring", "#TechJobs", "#Careers"],
    share: "Join the team building Software Vala.",
    offer: "Apply to join the Software Vala team.",
  },
};

/** The SEO set for a role, or null when the role is not a partner programme. */
export function partnerSeo(roleKey: string | null | undefined): PartnerSeo | null {
  if (!roleKey) return null;
  return PARTNERS[roleKey.toLowerCase()] ?? null;
}

/** Base tags plus the role's own, de-duplicated and capped so it reads as a post. */
export function partnerHashtags(roleKey: string | null | undefined, limit = 8): string[] {
  const own = partnerSeo(roleKey)?.hashtags ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of [...own, ...PARTNER_BASE_HASHTAGS]) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Structured data for a partner programme page.
 *
 * Deliberately an Organization with an Offer rather than a JobPosting: a
 * partner programme is not employment, and a JobPosting without a real
 * location, employment type and validity window is the kind of markup Google
 * treats as spam. No aggregateRating, because there is no verified rating to
 * report.
 */
export function partnerStructuredData(input: {
  roleKey: string;
  roleLabel: string;
  url: string;
  description: string;
}) {
  const seo = partnerSeo(input.roleKey);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: input.roleLabel,
    url: input.url,
    description: input.description,
    ...(seo?.keywords.length ? { keywords: seo.keywords.join(", ") } : {}),
    about: {
      "@type": "Organization",
      name: "Software Vala",
      url: "https://softwarevala.net",
      sameAs: [
        "https://facebook.com/share/1HpGSvExis",
        "https://instagram.com/new_software_vala",
        "https://youtube.com/@softwarevala",
      ],
      ...(seo?.offer
        ? {
            makesOffer: {
              "@type": "Offer",
              name: input.roleLabel.replace(/^Become\s+/i, ""),
              description: seo.offer,
              // No price and no priceCurrency: the programme fee is shown on
              // the page itself and is not a product price, and inventing one
              // here would put a wrong number into search results.
              availability: "https://schema.org/InStock",
              seller: { "@type": "Organization", name: "Software Vala" },
            },
          }
        : {}),
    },
  };
}
