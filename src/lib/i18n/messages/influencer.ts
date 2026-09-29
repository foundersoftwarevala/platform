/** The influencer's own portal (src/components/influencer/InfluencerReferralLinks.tsx). English only. */
export const INFLUENCER_MESSAGES = {
  // Referral links
  "influencer.referral.eyebrow": "Referral",
  "influencer.referral.title": "Your referral links",
  "influencer.referral.intro": [
    "Share a link. A sale through it is credited to you when the payment clears, inside a {days}-day window from the visitor's last click.",
    "days is the attribution window, e.g. 60",
  ],
  "influencer.referral.loading": "Loading your links",
  "influencer.referral.none": "You have no links yet.",
  "influencer.referral.summary": [
    "{links, plural, one {# link} other {# links}}, {lines, plural, one {# commission line} other {# commission lines}}.",
    "how many referral links and commission lines the influencer has",
  ],
  "influencer.referral.create": "Create a link",
  "influencer.referral.copy": "Copy",
  "influencer.referral.copied": "Link copied",
  "influencer.referral.copy_failed": "Could not copy — the link is shown in full below",
  "influencer.referral.active": "Active",
  "influencer.referral.off": "Off",
  "influencer.referral.failed": "That did not work",

  // Column headings on the links table
  "influencer.referral.col_code": "Code",
  "influencer.referral.col_link": "Link",
  "influencer.referral.col_clicks": "Clicks",
  "influencer.referral.col_visitors": "Visitors",
  "influencer.referral.col_sales": "Sales",
  "influencer.referral.col_rate": "Rate",

  // Earnings summary
  "influencer.referral.pending": "Pending",
  "influencer.referral.approved": "Approved",
  "influencer.referral.paid": "Paid",
  "influencer.referral.reversed": "Reversed",

  // Tier panel
  "influencer.tier.label": "Your tier",
  "influencer.tier.per_sale": "per referred sale",
  "influencer.tier.hold": [
    "Held {days} days before payout · paid from {floor}",
    "how long commission is held, and the smallest payout raised",
  ],
  "influencer.tier.next": [
    "{name} pays {percent}%.",
    "the next tier up and what it pays",
  ],
  "influencer.tier.needs_followers": [
    "{count} more verified followers",
    "how many more followers are needed for the next tier",
  ],
  "influencer.tier.needs_sales": [
    "{count} more sales in 90 days",
    "how many more sales are needed for the next tier",
  ],
  "influencer.tier.needs_revenue": [
    "{amount} more attributed revenue in 180 days",
    "how much more revenue is needed for the next tier",
  ],
  "influencer.tier.or": [", or ", "joins two ways of reaching the next tier"],
  "influencer.tier.qualified": "You already qualify — the next run will move you up.",

  // Promote a product
  "influencer.promote.title": "Promote a product",
  "influencer.promote.intro":
    "Pick a product and get a link and a QR code for it. A scan is counted, then the person lands on that product with your code attached.",
  "influencer.promote.search_placeholder": "Search the catalogue — at least two letters",
  "influencer.promote.search": "Search",
  "influencer.promote.searching": "Searching",
  "influencer.promote.no_match": "Nothing matched that.",
  "influencer.promote.get": "Get link & QR",
  "influencer.promote.ready": ["Ready — {url}", "confirmation that a referral link was created"],
  "influencer.promote.scans": [
    "{count, plural, one {# scan} other {# scans}}",
    "how many times this QR has been scanned",
  ],
  "influencer.promote.copy_link": "Copy link",
  "influencer.promote.png": "PNG",
  "influencer.promote.svg": "SVG for print",
  "influencer.promote.qr_alt": ["QR for {name}", "alternative text for a product's QR image"],
  "influencer.promote.product": "Product",
  "influencer.promote.qr_failed": "Your QR codes could not be read",

  "influencer.common.back": "Back",
} as const;
