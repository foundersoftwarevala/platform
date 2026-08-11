import {
  Gift, Ticket, QrCode, Link2, BarChart3, History,
  Inbox, UserPlus, ShoppingCart, Wallet, Banknote, RotateCcw, LifeBuoy, ShieldCheck,
  KeyRound, Lock, Smartphone, MonitorSmartphone, Activity, Globe, FileKey2, BookLock, IdCard,
  User, Building2, Palette, CreditCard, Landmark, IndianRupee, Receipt, BellRing, EyeOff, Languages, Coins,
  type LucideIcon,
} from "lucide-react";

export type CenterKey = "referral" | "pending" | "security" | "settings";

export type CenterFeature = {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
  cta?: string;
  badge?: string;
};

export type CenterSection = {
  key: string;
  label: string;
  features: CenterFeature[];
};

export type CenterConfig = {
  key: CenterKey;
  label: string;
  title: string;
  tagline: string;
  icon: LucideIcon;
  gradient: string;
  accent: string;
  sections: CenterSection[];
};

export const RESELLER_CENTERS: Record<CenterKey, CenterConfig> = {
  referral: {
    key: "referral",
    label: "Referral & Coupons",
    title: "Referral & Coupon Center",
    tagline: "Share, track, and convert — every link earns.",
    icon: Gift,
    gradient: "linear-gradient(120deg, oklch(0.28 0.08 175), oklch(0.34 0.16 160), oklch(0.42 0.2 150))",
    accent: "oklch(0.8 0.18 160)",
    sections: [
      {
        key: "referral", label: "Referral Suite",
        features: [
          { key: "link",   label: "Referral Link Generator", icon: Link2,   description: "Generate trackable referral URLs for any product or campaign." },
          { key: "qr",     label: "Referral QR Code",        icon: QrCode,  description: "Auto-generate scannable QR codes for events & WhatsApp shares." },
        ],
      },
      {
        key: "coupons", label: "Coupon Workshop",
        features: [
          { key: "gen",       label: "Coupon Generator",       icon: Ticket,    description: "Create branded coupon codes with rules and stacking." },
          { key: "discount",  label: "Discount Coupons",       icon: Ticket,    description: "Flat or percentage discounts across the catalog." },
          { key: "campaign",  label: "Campaign Coupons",       icon: Ticket,    description: "Limit by campaign, audience or referral source." },
          { key: "limited",   label: "Limited Time Coupons",   icon: Ticket,    description: "Schedule start, end & countdown badges automatically." },
        ],
      },
      {
        key: "insights", label: "Insights",
        features: [
          { key: "analytics", label: "Coupon Analytics",  icon: BarChart3, description: "Redemptions, AOV uplift and channel performance." },
          { key: "history",   label: "Coupon Usage History", icon: History,  description: "Audit-grade ledger of every redemption." },
        ],
      },
    ],
  },
  pending: {
    key: "pending",
    label: "Pending Center",
    title: "Pending Center",
    tagline: "Everything waiting on you — in one queue.",
    icon: Inbox,
    gradient: "linear-gradient(120deg, oklch(0.26 0.05 70), oklch(0.32 0.16 60), oklch(0.42 0.2 45))",
    accent: "oklch(0.82 0.18 70)",
    sections: [
      {
        key: "queue", label: "Awaiting action",
        features: [
          { key: "leads",       label: "Pending Leads",          icon: UserPlus,   description: "Leads that need first contact or follow-up." },
          { key: "orders",      label: "Pending Orders",         icon: ShoppingCart, description: "Orders awaiting fulfilment, payment or approval." },
          { key: "commissions", label: "Pending Commissions",    icon: Wallet,     description: "Commissions queued for review or payout." },
          { key: "withdrawals", label: "Pending Withdrawals",    icon: Banknote,   description: "Payout requests waiting on bank or finance." },
          { key: "renewals",    label: "Pending Renewals",       icon: RotateCcw,  description: "License renewals due in the next billing window." },
          { key: "support",     label: "Pending Support Tickets", icon: LifeBuoy,  description: "Open conversations awaiting reseller reply." },
          { key: "approvals",   label: "Pending Approvals",      icon: ShieldCheck, description: "Items needing admin sign-off." },
        ],
      },
    ],
  },
  security: {
    key: "security",
    label: "Security Center",
    title: "Security Center",
    tagline: "Lock it down. Audit everything.",
    icon: ShieldCheck,
    gradient: "linear-gradient(120deg, oklch(0.24 0.05 250), oklch(0.3 0.14 240), oklch(0.4 0.2 230))",
    accent: "oklch(0.78 0.18 240)",
    sections: [
      {
        key: "account", label: "Account security",
        features: [
          { key: "password", label: "Change Password",      icon: KeyRound,         description: "Rotate your sign-in password." },
          { key: "2fa",      label: "2FA Authentication",   icon: Lock,             description: "TOTP & SMS multi-factor authentication." },
          { key: "devices",  label: "Device Management",    icon: MonitorSmartphone, description: "Trust, name or revoke individual devices." },
          { key: "sessions", label: "Active Sessions",      icon: Smartphone,       description: "See where you're signed in right now." },
        ],
      },
      {
        key: "audit", label: "Audit & access",
        features: [
          { key: "history",  label: "Login History",  icon: Activity,  description: "Per-IP login attempts and locations." },
          { key: "tokens",   label: "API Tokens",     icon: FileKey2,  description: "Personal access tokens for integrations." },
          { key: "logs",     label: "Security Logs",  icon: BookLock,  description: "Sensitive actions and admin escalations." },
          { key: "kyc",      label: "KYC Verification", icon: IdCard,  description: "Identity & business verification status." },
          { key: "ip",       label: "IP Allowlist",   icon: Globe,     description: "Restrict dashboard access by network." },
        ],
      },
    ],
  },
  settings: {
    key: "settings",
    label: "Settings Center",
    title: "Settings Center",
    tagline: "Your business, configured the way you like.",
    icon: User,
    gradient: "linear-gradient(120deg, oklch(0.24 0.04 290), oklch(0.3 0.12 280), oklch(0.4 0.18 270))",
    accent: "oklch(0.78 0.18 285)",
    sections: [
      {
        key: "identity", label: "Identity & brand",
        features: [
          { key: "profile",  label: "Profile Settings",  icon: User,      description: "Name, avatar, contact & timezone." },
          { key: "company",  label: "Company Settings",  icon: Building2, description: "Legal name, GSTIN, address & company logo." },
          { key: "branding", label: "Branding Settings", icon: Palette,   description: "Storefront colors, fonts & email signature." },
        ],
      },
      {
        key: "payments", label: "Payments & tax",
        features: [
          { key: "payment", label: "Payment Settings", icon: CreditCard, description: "Default checkout providers & receipts." },
          { key: "bank",    label: "Bank Account",     icon: Landmark,   description: "Beneficiary account for payouts." },
          { key: "upi",     label: "UPI Details",      icon: IndianRupee, description: "VPA / UPI ID for instant Indian payouts." },
          { key: "tax",     label: "Tax Settings",     icon: Receipt,    description: "GST, VAT and withholding rules." },
        ],
      },
      {
        key: "experience", label: "Experience",
        features: [
          { key: "notifications", label: "Notification Settings", icon: BellRing, description: "Email, push and webhook preferences." },
          { key: "privacy",       label: "Privacy Settings",      icon: EyeOff,   description: "Data sharing, telemetry and visibility." },
          { key: "language",      label: "Language",              icon: Languages, description: "Interface language (EN / HI / AR / ES / FR / DE)." },
          { key: "currency",      label: "Currency",              icon: Coins,     description: "Display currency for KPIs & invoices." },
        ],
      },
    ],
  },
};

export const RESELLER_CENTER_ORDER: CenterKey[] = ["referral", "pending", "security", "settings"];

/** 10 dynamic reseller banners (admin-manageable). */
export const RESELLER_BANNERS: Array<{
  eyebrow: string;
  headline: string;
  sub: string;
  cta: string;
  gradient: string;
  accent: string;
}> = [
  { eyebrow: "Lifetime Income", headline: "Earn Lifetime Commissions",        sub: "Recurring revenue on every renewal you bring in.", cta: "View commissions", gradient: "linear-gradient(120deg, oklch(0.28 0.08 175), oklch(0.34 0.18 160), oklch(0.42 0.22 150))", accent: "oklch(0.82 0.18 160)" },
  { eyebrow: "Catalog", headline: "Resell Premium Software",                  sub: "Curated, ready-to-sell software with white-label kits.", cta: "Browse catalog",  gradient: "linear-gradient(120deg, oklch(0.26 0.06 260), oklch(0.32 0.16 250), oklch(0.42 0.22 240))", accent: "oklch(0.8 0.2 250)" },
  { eyebrow: "Bestsellers", headline: "Top Selling Products",                 sub: "What converts right now across the marketplace.",   cta: "See top 50",      gradient: "linear-gradient(120deg, oklch(0.28 0.07 40), oklch(0.34 0.18 30), oklch(0.42 0.22 20))",  accent: "oklch(0.84 0.18 35)" },
  { eyebrow: "AI Ready", headline: "AI Ready Software Collection",            sub: "Plug AI features straight into your client stacks.", cta: "Open AI collection", gradient: "linear-gradient(120deg, oklch(0.26 0.06 290), oklch(0.32 0.18 275), oklch(0.44 0.22 260))", accent: "oklch(0.82 0.2 275)" },
  { eyebrow: "Marketplace", headline: "SaaS Marketplace Access",              sub: "Unlock every reseller-eligible SaaS in one click.", cta: "Open marketplace", gradient: "linear-gradient(120deg, oklch(0.24 0.05 200), oklch(0.3 0.14 190), oklch(0.4 0.2 180))",   accent: "oklch(0.82 0.16 190)" },
  { eyebrow: "Referrals", headline: "Generate Referral Links",                sub: "Trackable URLs, QR codes & UTM in seconds.",        cta: "Open generator",   gradient: "linear-gradient(120deg, oklch(0.26 0.07 145), oklch(0.32 0.16 135), oklch(0.42 0.2 125))", accent: "oklch(0.82 0.18 135)" },
  { eyebrow: "Coupons", headline: "Create Discount Coupons",                  sub: "Build promo codes, schedule & analyse them.",       cta: "New coupon",       gradient: "linear-gradient(120deg, oklch(0.26 0.07 320), oklch(0.32 0.18 330), oklch(0.42 0.22 340))", accent: "oklch(0.82 0.2 325)" },
  { eyebrow: "Growth", headline: "Grow Your Monthly Revenue",                 sub: "Personal growth plan tailored to your pipeline.",   cta: "Show plan",        gradient: "linear-gradient(120deg, oklch(0.26 0.06 105), oklch(0.32 0.16 95), oklch(0.42 0.22 85))",  accent: "oklch(0.86 0.2 95)" },
  { eyebrow: "Leaderboard", headline: "Become Top Ranked Reseller",           sub: "Climb the leaderboard, unlock elite tier perks.",    cta: "View ranks",       gradient: "linear-gradient(120deg, oklch(0.26 0.08 60), oklch(0.32 0.18 50), oklch(0.42 0.22 35))",  accent: "oklch(0.86 0.2 50)" },
  { eyebrow: "Partner Network", headline: "Join Software Vala Partner Network", sub: "Co-marketing, events, leads — the whole network.",  cta: "Explore network",  gradient: "linear-gradient(120deg, oklch(0.26 0.06 0), oklch(0.32 0.18 350), oklch(0.42 0.22 335))",   accent: "oklch(0.84 0.2 350)" },
];
