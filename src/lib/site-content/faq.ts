/**
 * Storefront FAQ content — AI-generated for the Software Vala system and
 * editable from Marketplace Manager -> Growth -> FAQ.
 */
import { createTable, uid } from "@/lib/marketplace-manager/store";
import { LIFETIME_PRICE, SITE_STATS } from "./constants";

export type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  published: boolean;
  order: number;
};

export const FAQ_CATEGORIES = [
  "General",
  "Pricing & Licensing",
  "Delivery & Setup",
  "Demos",
  "White Label & SaaS",
  "Partners",
  "Support & Security",
] as const;

const seedRows: Array<[string, string, string]> = [
  ["General", `What exactly is Software Vala?`, `Software Vala is a ready-to-deploy software marketplace with ${SITE_STATS.solutions} business solutions across ${SITE_STATS.categories} master categories — ERP, CRM, healthcare, education, logistics, POS, HR, SaaS and more. You pick a product, see a live demo, pay once and get it deployed.`],
  ["General", `How many products and categories are available?`, `${SITE_STATS.solutions} software solutions organised into ${SITE_STATS.categories} master categories, each with related sub-category modules so you can start narrow and expand later.`],
  ["General", `Is every product production-ready or just a template?`, `Every listing is a working product with an admin panel, roles, reporting and data model — not a UI template. You get the full frontend and backend.`],
  ["General", `Can I get a product customised for my business?`, `Yes. Every product supports paid customisation — extra modules, branding, workflows and integrations. Raise a request from the product page and our team scopes it within one business day.`],
  ["Pricing & Licensing", `How much does a product cost?`, `One fixed price across the entire ecosystem: ${LIFETIME_PRICE} one-time for lifetime access. No tiers, no per-seat pricing, no renewals — that is our USP.`],
  ["Pricing & Licensing", `Why is every product the same price?`, `Because comparing prices wastes your time. Whether it is a school ERP or a multi-vendor marketplace, the price stays ${LIFETIME_PRICE} lifetime so you choose on fit, not on budget.`],
  ["Pricing & Licensing", `Is ${LIFETIME_PRICE} really a one-time payment?`, `Yes. There is no advance payment, no hidden charge, no monthly fee and no forced renewal. You pay ${LIFETIME_PRICE} once and the licence never expires.`],
  ["Pricing & Licensing", `What does the lifetime licence include?`, `Lifetime use of the product, all version updates, source code access, one year of free technical support and no usage caps on your own domain.`],
  ["Pricing & Licensing", `Do I get the source code?`, `Yes — full frontend and backend source code is delivered with every purchase, so your own team can extend it.`],
  ["Pricing & Licensing", `Do you offer refunds?`, `Because live demos are open before purchase, refunds apply only when a product cannot be delivered or does not match its published feature list. Raise a ticket within 7 days and we resolve or refund.`],
  ["Pricing & Licensing", `Do you provide a GST invoice?`, `Yes, a GST-compliant invoice is generated automatically after payment and is available in your account downloads.`],
  ["Delivery & Setup", `How does 2-hour delivery work?`, `Once payment is confirmed, provisioning starts automatically. Credentials, source code and setup notes reach your email within 120 minutes.`],
  ["Delivery & Setup", `Can you host and deploy it for me?`, `Yes. Choose self-hosted (we hand over code plus a deployment guide) or managed deployment where our team installs it on your domain and server.`],
  ["Delivery & Setup", `Which stack do the products use?`, `Modern React/TypeScript frontends with Node or PHP backends and PostgreSQL/MySQL databases. The exact stack is listed on each product card under Tech Stack.`],
  ["Delivery & Setup", `Can I migrate my existing data?`, `Yes. Send a CSV or database dump and our migration team maps and imports your records as part of onboarding.`],
  ["Demos", `Can I try a product before paying?`, `Yes. Every listing links to a real live demo with sample data. Demo credentials are shown on the demo screen — no signup and no card required.`],
  ["Demos", `Are the demos the same build I receive?`, `Yes. Demos run the same release you get on delivery, so what you test is what you deploy.`],
  ["Demos", `A demo link is not opening — what now?`, `Demo health is monitored continuously. If a demo is under maintenance the card shows its status; request a fresh demo link from the product page and it is re-issued instantly.`],
  ["White Label & SaaS", `Can I sell these products under my own brand?`, `Yes. White label is included in the standard licence — replace the logo, colours, domain and product name and sell it as your own.`],
  ["White Label & SaaS", `Can I run a product as a SaaS with multiple clients?`, `Yes. SaaS-ready builds ship with multi-tenant support, subscription plans and tenant-level admin so you can onboard unlimited customers.`],
  ["White Label & SaaS", `Is my white-label brand protected?`, `Yes — trademark-protected branding, per-tenant asset isolation and licence keys tied to your account keep your brand and your clients separate from ours.`],
  ["Partners", `How does the reseller programme work?`, `Resellers earn up to 40% margin on every ${LIFETIME_PRICE} licence, get a branded storefront, demo access and lead routing from the marketplace.`],
  ["Partners", `Can I publish my own product on the marketplace?`, `Yes. Apply as a vendor or author, submit your product for the quality gate and security scan, and it goes live with the standard ${LIFETIME_PRICE} lifetime price.`],
  ["Partners", `Do you offer franchise or territory rights?`, `Yes — franchise partners get exclusive territory rights, onboarding, training and a regional revenue share. Apply from the Partner Ecosystem section.`],
  ["Support & Security", `What support do I get after purchase?`, `One year of free technical support on every licence — bug fixes, deployment help and update assistance — with extendable annual plans afterwards.`],
  ["Support & Security", `How secure are the products?`, `Every upload passes a security scan, role-based access control is built in, and enterprise deployments add SSO, audit logs and regional data residency.`],
  ["Support & Security", `Do I get future updates?`, `Yes. All major and minor version updates are included for life at no extra cost.`],
  ["Support & Security", `Is enterprise support available for large teams?`, `Yes — dedicated success manager, custom SLA, white-glove migration and 24/7 coverage for teams of 100 to 10,000+.`],
];

export const FAQ_SEED: Faq[] = seedRows.map(([category, question, answer], i) => ({
  id: `faq-${i + 1}`,
  question,
  answer,
  category,
  published: true,
  order: i + 1,
}));

export const faqTable = createTable<Faq>("faqs", FAQ_SEED);

export const listFaqs = () =>
  faqTable.all().sort((a, b) => a.order - b.order);

export const listPublishedFaqs = () => listFaqs().filter((f) => f.published);

export const newFaq = (category = "General"): Faq => ({
  id: uid(),
  question: "",
  answer: "",
  category,
  published: false,
  order: listFaqs().length + 1,
});