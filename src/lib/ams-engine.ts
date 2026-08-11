import {
  Home, Compass, IdCard, Fingerprint, TrendingUp, Crown,
  Trophy, Award, ShieldCheck, FileBadge, Layers,
  BarChart3, Sparkles, ScrollText, Target, Gift, Bell, History, User,
  Search, type LucideIcon,
} from "lucide-react";
import type { RoleKey } from "@/lib/roles";

export type AmsSectionKey =
  | "home" | "journey" | "passport" | "identity"
  | "achievements" | "awards" | "badges" | "trophies"
  | "certificates" | "collections" | "leaderboard"
  | "hall-of-fame" | "legacy" | "timeline"
  | "missions" | "rewards" | "notifications" | "history" | "profile" | "search";

export type AmsSection = {
  key: AmsSectionKey;
  label: string;
  icon: LucideIcon;
  group: "core" | "identity" | "collection" | "progress" | "social" | "meta";
  unlockLevel: number;
};

export const AMS_SECTIONS: AmsSection[] = [
  { key: "home",         label: "Home",         icon: Home,        group: "core",       unlockLevel: 1 },
  { key: "journey",      label: "Journey",      icon: Compass,     group: "core",       unlockLevel: 1 },
  { key: "passport",     label: "Passport",     icon: IdCard,      group: "identity",   unlockLevel: 1 },
  { key: "identity",     label: "Identity",     icon: Fingerprint, group: "identity",   unlockLevel: 1 },
  { key: "achievements", label: "Achievements", icon: Sparkles,    group: "progress",   unlockLevel: 1 },
  { key: "awards",       label: "Awards",       icon: Award,       group: "collection", unlockLevel: 2 },
  { key: "badges",       label: "Badges",       icon: ShieldCheck, group: "collection", unlockLevel: 1 },
  { key: "trophies",     label: "Trophies",     icon: Trophy,      group: "collection", unlockLevel: 2 },
  { key: "certificates", label: "Certificates", icon: FileBadge,   group: "collection", unlockLevel: 3 },
  { key: "collections",  label: "Collections",  icon: Layers,      group: "collection", unlockLevel: 2 },
  { key: "missions",     label: "Missions",     icon: Target,      group: "progress",   unlockLevel: 1 },
  { key: "rewards",      label: "Rewards",      icon: Gift,        group: "progress",   unlockLevel: 1 },
  { key: "leaderboard",  label: "Leaderboard",  icon: BarChart3,   group: "social",     unlockLevel: 2 },
  { key: "hall-of-fame", label: "Hall Of Fame", icon: Crown,       group: "social",     unlockLevel: 5 },
  { key: "legacy",       label: "Legacy",       icon: ScrollText,  group: "social",     unlockLevel: 4 },
  { key: "timeline",     label: "Timeline",     icon: TrendingUp,  group: "progress",   unlockLevel: 1 },
  { key: "notifications",label: "Notifications",icon: Bell,        group: "meta",       unlockLevel: 1 },
  { key: "history",      label: "History",      icon: History,     group: "meta",       unlockLevel: 1 },
  { key: "profile",      label: "Profile",      icon: User,        group: "meta",       unlockLevel: 1 },
  { key: "search",       label: "Search",       icon: Search,      group: "meta",       unlockLevel: 1 },
];

export type AmsItem = {
  key: string; label: string; requirement: string; xp: number; visibleAtLevel?: number;
};
export type AmsMission = {
  key: string; label: string; detail: string;
  cadence: "daily" | "weekly" | "monthly" | "special" | "founder" | "seasonal";
  xp: number;
};
export type AmsJourneyStage = {
  key: string; label: string; atLevel: number; detail: string;
};

export type AmsRoleConfig = {
  eyebrow: string; headline: string; subject: string;
  language: { performer: string; action: string; audience: string; domain: string };
  awards: AmsItem[]; badges: AmsItem[]; trophies: AmsItem[]; certificates: AmsItem[];
  missions: AmsMission[]; journey: AmsJourneyStage[];
  accent: string; gradient: string;
};

export const LEVELS: { level: number; label: string; xpFrom: number; xpTo: number }[] = [
  { level: 1, label: "Rookie",  xpFrom: 0,     xpTo: 250 },
  { level: 2, label: "Rising",  xpFrom: 250,   xpTo: 750 },
  { level: 3, label: "Skilled", xpFrom: 750,   xpTo: 1750 },
  { level: 4, label: "Expert",  xpFrom: 1750,  xpTo: 3500 },
  { level: 5, label: "Elite",   xpFrom: 3500,  xpTo: 6500 },
  { level: 6, label: "Master",  xpFrom: 6500,  xpTo: 11000 },
  { level: 7, label: "Legend",  xpFrom: 11000, xpTo: 20000 },
  { level: 8, label: "Mythic",  xpFrom: 20000, xpTo: 40000 },
];

export function levelForXp(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xpFrom) return LEVELS[i];
  }
  return LEVELS[0];
}

const author: AmsRoleConfig = {
  eyebrow: "Author Journey",
  headline: "Author Achievement Passport",
  subject: "Author",
  language: { performer: "Author", action: "publish", audience: "readers", domain: "Publishing" },
  awards: [
    { key:"first-title",     label:"First Title Published", requirement:"Publish 1 title",           xp:100 },
    { key:"bestseller",      label:"Bestseller",            requirement:"Sell 500 copies",           xp:400, visibleAtLevel:3 },
    { key:"editor-pick",     label:"Editor's Pick",         requirement:"Featured by editorial",     xp:300, visibleAtLevel:2 },
    { key:"critics-choice",  label:"Critics' Choice",       requirement:"Avg. rating >= 4.8 (100+)", xp:600, visibleAtLevel:4 },
    { key:"lifetime-author", label:"Lifetime Author",       requirement:"Publish for 5 years",       xp:1200, visibleAtLevel:6 },
  ],
  badges: [
    { key:"verified-author", label:"Verified Author",      requirement:"Complete identity check", xp:50 },
    { key:"first-review",    label:"First Review",         requirement:"Receive 1 review",        xp:40 },
    { key:"10-titles",       label:"Prolific · 10 Titles", requirement:"Publish 10 titles",       xp:250, visibleAtLevel:3 },
    { key:"1k-readers",      label:"1K Readers",           requirement:"Reach 1,000 readers",     xp:200, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"quill-bronze",   label:"Bronze Quill",   requirement:"Reach Level 2", xp:150 },
    { key:"quill-silver",   label:"Silver Quill",   requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"quill-gold",     label:"Gold Quill",     requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
    { key:"quill-platinum", label:"Platinum Quill", requirement:"Reach Level 8", xp:2000, visibleAtLevel:7 },
  ],
  certificates: [
    { key:"verified-publisher", label:"Verified Publisher Certificate", requirement:"Verified profile", xp:0 },
    { key:"bestseller-cert",    label:"Bestseller Certificate",         requirement:"500+ copies sold", xp:0, visibleAtLevel:3 },
  ],
  missions: [
    { key:"daily-write",       label:"Daily Writing Session",   detail:"Log any writing progress today.",          cadence:"daily",    xp:15 },
    { key:"weekly-reply",      label:"Reply to Reader Reviews", detail:"Reply to 5 reader reviews this week.",     cadence:"weekly",   xp:60 },
    { key:"monthly-launch",    label:"Publish A New Chapter",   detail:"Publish 1+ chapter this month.",           cadence:"monthly",  xp:150 },
    { key:"seasonal-anthology",label:"Seasonal Anthology",      detail:"Contribute to the seasonal collection.",   cadence:"seasonal", xp:300 },
  ],
  journey: [
    { key:"draft",       label:"Draft",       atLevel:1, detail:"Working on your first title." },
    { key:"published",   label:"Published",   atLevel:2, detail:"First published work is live." },
    { key:"noticed",     label:"Noticed",     atLevel:3, detail:"Building a reader base." },
    { key:"established", label:"Established", atLevel:5, detail:"Consistent multi-title author." },
    { key:"legacy",      label:"Legacy",      atLevel:7, detail:"Recognised in the author hall." },
  ],
  accent: "oklch(0.75 0.2 300)",
  gradient: "linear-gradient(120deg, oklch(0.28 0.08 290) 0%, oklch(0.32 0.18 280) 55%, oklch(0.42 0.22 310) 100%)",
};

const reseller: AmsRoleConfig = {
  eyebrow: "Reseller Journey",
  headline: "Reseller Achievement Passport",
  subject: "Reseller",
  language: { performer: "Reseller", action: "close", audience: "clients", domain: "Sales" },
  awards: [
    { key:"first-client",   label:"First Client",      requirement:"Onboard 1 client",     xp:100 },
    { key:"ten-active",     label:"10 Active Clients", requirement:"Maintain 10 active",   xp:300, visibleAtLevel:2 },
    { key:"renewal-hero",   label:"Renewal Hero",      requirement:"90%+ renewal rate",    xp:500, visibleAtLevel:3 },
    { key:"top-earner",     label:"Top Earner Q",      requirement:"Rank Top 10 quarterly",xp:700, visibleAtLevel:4 },
    { key:"regional-lead",  label:"Regional Lead",     requirement:"#1 in your region",    xp:1200, visibleAtLevel:5 },
  ],
  badges: [
    { key:"verified-reseller", label:"Verified Reseller", requirement:"Verified account",     xp:50 },
    { key:"first-license",     label:"First License",     requirement:"Issue 1 license",      xp:40 },
    { key:"100-licenses",      label:"100 Licenses",      requirement:"Issue 100 licenses",   xp:250, visibleAtLevel:3 },
    { key:"zero-refund-month", label:"Clean Month",       requirement:"0 refunds in a month", xp:120, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"deal-bronze",   label:"Bronze Dealmaker",   requirement:"Reach Level 2", xp:150 },
    { key:"deal-silver",   label:"Silver Dealmaker",   requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"deal-gold",     label:"Gold Dealmaker",     requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
    { key:"deal-platinum", label:"Platinum Dealmaker", requirement:"Reach Level 8", xp:2000, visibleAtLevel:7 },
  ],
  certificates: [
    { key:"authorized-reseller", label:"Authorized Reseller Certificate", requirement:"Verified profile", xp:0 },
    { key:"premier-partner",     label:"Premier Partner Certificate",     requirement:"Level 4+",         xp:0, visibleAtLevel:4 },
  ],
  missions: [
    { key:"daily-followup", label:"Client Follow-up",    detail:"Follow up with 3 clients today.",    cadence:"daily",   xp:20 },
    { key:"weekly-demo",    label:"Product Demo",        detail:"Run 2 product demos this week.",     cadence:"weekly",  xp:80 },
    { key:"monthly-quota",  label:"Monthly Quota",       detail:"Hit monthly revenue quota.",         cadence:"monthly", xp:200 },
    { key:"founder-summit", label:"Founder Summit RSVP", detail:"Reserve your seat at the summit.",   cadence:"founder", xp:250 },
  ],
  journey: [
    { key:"onboard",  label:"Onboarding",      atLevel:1, detail:"Setting up your first clients." },
    { key:"active",   label:"Active Seller",   atLevel:2, detail:"Consistent monthly deals." },
    { key:"trusted",  label:"Trusted Partner", atLevel:3, detail:"Renewals stabilising the book." },
    { key:"premier",  label:"Premier Partner", atLevel:5, detail:"Regional scale, multi-vertical." },
    { key:"legacy",   label:"Legacy Partner",  atLevel:7, detail:"Named partner in the network." },
  ],
  accent: "oklch(0.78 0.16 165)",
  gradient: "linear-gradient(120deg, oklch(0.26 0.06 175) 0%, oklch(0.3 0.14 165) 55%, oklch(0.38 0.18 155) 100%)",
};

const vendor: AmsRoleConfig = {
  eyebrow: "Vendor Journey",
  headline: "Vendor Achievement Passport",
  subject: "Vendor",
  language: { performer: "Vendor", action: "ship", audience: "customers", domain: "Marketplace" },
  awards: [
    { key:"first-sale",   label:"First Sale",         requirement:"Complete 1 order",   xp:100 },
    { key:"100-orders",   label:"100 Orders Shipped", requirement:"Ship 100 orders",    xp:400, visibleAtLevel:3 },
    { key:"5-star-store", label:"5-Star Store",       requirement:"Store rating >= 4.8",xp:300, visibleAtLevel:2 },
    { key:"scale-master", label:"Scale Master",       requirement:"$100k lifetime GMV", xp:800, visibleAtLevel:5 },
  ],
  badges: [
    { key:"verified-vendor", label:"Verified Vendor", requirement:"Verified account",       xp:50 },
    { key:"fast-shipper",    label:"Fast Shipper",    requirement:"< 24h avg ship time",    xp:120, visibleAtLevel:2 },
    { key:"no-cancels",      label:"No Cancels",      requirement:"0 cancels in 30 days",   xp:100 },
  ],
  trophies: [
    { key:"market-bronze", label:"Bronze Marketeer", requirement:"Reach Level 2", xp:150 },
    { key:"market-silver", label:"Silver Marketeer", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"market-gold",   label:"Gold Marketeer",   requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
  ],
  certificates: [
    { key:"marketplace-seller", label:"Marketplace Seller Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-restock",  label:"Restock Check",    detail:"Review low-stock items today.",     cadence:"daily",   xp:15 },
    { key:"weekly-promo",   label:"Weekly Promo",     detail:"Launch a promo this week.",         cadence:"weekly",  xp:70 },
    { key:"monthly-review", label:"Reply To Reviews", detail:"Reply to all reviews this month.",  cadence:"monthly", xp:150 },
  ],
  journey: [
    { key:"listed",      label:"Listed",             atLevel:1, detail:"Products live in your store." },
    { key:"shipping",    label:"Shipping",           atLevel:2, detail:"Regular orders flowing." },
    { key:"trusted",     label:"Trusted Store",      atLevel:4, detail:"High rating, low returns." },
    { key:"marketplace", label:"Marketplace Leader", atLevel:6, detail:"Category leader in your niche." },
  ],
  accent: "oklch(0.78 0.16 210)",
  gradient: "linear-gradient(120deg, oklch(0.26 0.05 240) 0%, oklch(0.3 0.15 215) 55%, oklch(0.38 0.18 195) 100%)",
};

const affiliate: AmsRoleConfig = {
  eyebrow: "Affiliate Journey",
  headline: "Affiliate Achievement Passport",
  subject: "Affiliate",
  language: { performer: "Affiliate", action: "refer", audience: "leads", domain: "Referrals" },
  awards: [
    { key:"first-referral", label:"First Referral",  requirement:"Refer 1 conversion", xp:100 },
    { key:"link-master",    label:"Link Master",     requirement:"Publish 25 links",   xp:250, visibleAtLevel:2 },
    { key:"cash-hero",      label:"Cash Hero",       requirement:"$1k in commissions", xp:500, visibleAtLevel:3 },
    { key:"top-affiliate",  label:"Top Affiliate Q", requirement:"Top 25 quarterly",   xp:800, visibleAtLevel:5 },
  ],
  badges: [
    { key:"verified-affiliate", label:"Verified Affiliate", requirement:"Verified account", xp:50 },
    { key:"first-click",        label:"First Click",        requirement:"1 tracked click",  xp:20 },
    { key:"1k-clicks",          label:"1K Clicks",          requirement:"1,000 clicks",     xp:200, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"ref-bronze", label:"Bronze Referrer", requirement:"Reach Level 2", xp:150 },
    { key:"ref-silver", label:"Silver Referrer", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"ref-gold",   label:"Gold Referrer",   requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
  ],
  certificates: [
    { key:"affiliate-partner", label:"Affiliate Partner Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-share",    label:"Daily Share",   detail:"Share your link on any channel today.", cadence:"daily",   xp:15 },
    { key:"weekly-content", label:"Content Piece", detail:"Publish 1 content piece this week.",    cadence:"weekly",  xp:70 },
    { key:"monthly-goal",   label:"Monthly Goal",  detail:"Hit this month's commission target.",   cadence:"monthly", xp:180 },
  ],
  journey: [
    { key:"joined",   label:"Joined",   atLevel:1, detail:"Your links are ready to go." },
    { key:"tracking", label:"Tracking", atLevel:2, detail:"Clicks and conversions rolling in." },
    { key:"earning",  label:"Earning",  atLevel:3, detail:"Regular commissions each cycle." },
    { key:"top-tier", label:"Top Tier", atLevel:5, detail:"Ranked among top affiliates." },
  ],
  accent: "oklch(0.8 0.16 55)",
  gradient: "linear-gradient(120deg, oklch(0.26 0.08 50) 0%, oklch(0.32 0.16 40) 55%, oklch(0.42 0.2 30) 100%)",
};

const influencer: AmsRoleConfig = {
  eyebrow: "Creator Journey",
  headline: "Influencer Achievement Passport",
  subject: "Influencer",
  language: { performer: "Influencer", action: "post", audience: "audience", domain: "Audience" },
  awards: [
    { key:"first-deal",     label:"First Brand Deal", requirement:"Close 1 brand deal",   xp:150 },
    { key:"engagement-ace", label:"Engagement Ace",   requirement:"Avg. engagement >= 5%",xp:400, visibleAtLevel:3 },
    { key:"100k-audience",  label:"100K Audience",    requirement:"Reach 100K followers", xp:700, visibleAtLevel:4 },
  ],
  badges: [
    { key:"verified-creator", label:"Verified Creator", requirement:"Verified account", xp:50 },
    { key:"first-post",       label:"First Post",       requirement:"Publish 1 post",   xp:20 },
    { key:"10-campaigns",     label:"10 Campaigns",     requirement:"Run 10 campaigns", xp:250, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"star-bronze", label:"Bronze Star", requirement:"Reach Level 2", xp:150 },
    { key:"star-silver", label:"Silver Star", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"star-gold",   label:"Gold Star",   requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
  ],
  certificates: [
    { key:"partner-creator", label:"Partner Creator Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-post",      label:"Daily Post",      detail:"Publish or story-post today.",   cadence:"daily",   xp:15 },
    { key:"weekly-campaign", label:"Weekly Campaign", detail:"Launch or continue 1 campaign.", cadence:"weekly",  xp:80 },
    { key:"monthly-brand",   label:"Brand Pitch",     detail:"Pitch 3 brands this month.",     cadence:"monthly", xp:200 },
  ],
  journey: [
    { key:"joined",    label:"Joined",    atLevel:1, detail:"Studio set up." },
    { key:"growing",   label:"Growing",   atLevel:2, detail:"Audience building." },
    { key:"partnered", label:"Partnered", atLevel:3, detail:"Regular brand collaborations." },
    { key:"marquee",   label:"Marquee",   atLevel:5, detail:"Marquee creator in your niche." },
  ],
  accent: "oklch(0.78 0.2 340)",
  gradient: "linear-gradient(120deg, oklch(0.28 0.1 350) 0%, oklch(0.32 0.18 340) 55%, oklch(0.42 0.22 20) 100%)",
};

const franchise: AmsRoleConfig = {
  eyebrow: "Franchise Journey",
  headline: "Franchise Achievement Passport",
  subject: "Franchise",
  language: { performer: "Franchisee", action: "expand", audience: "customers", domain: "Network" },
  awards: [
    { key:"first-branch",   label:"First Branch",     requirement:"Open 1 branch",       xp:200 },
    { key:"five-branches",  label:"5 Branch Network", requirement:"Operate 5 branches",  xp:600, visibleAtLevel:3 },
    { key:"regional-lead",  label:"Regional Leader",  requirement:"#1 region revenue",   xp:900, visibleAtLevel:5 },
  ],
  badges: [
    { key:"verified-franchise", label:"Verified Franchise", requirement:"Verified account",   xp:50 },
    { key:"first-hire",         label:"First Hire",         requirement:"Onboard 1 employee", xp:40 },
  ],
  trophies: [
    { key:"net-bronze", label:"Bronze Network", requirement:"Reach Level 2", xp:150 },
    { key:"net-silver", label:"Silver Network", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"net-gold",   label:"Gold Network",   requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
  ],
  certificates: [
    { key:"authorized-franchise", label:"Authorized Franchise Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-branch-check", label:"Branch Check-in", detail:"Confirm every branch is open today.",  cadence:"daily",   xp:20 },
    { key:"weekly-training",    label:"Weekly Training", detail:"Run 1 staff training this week.",      cadence:"weekly",  xp:80 },
    { key:"monthly-review",     label:"Branch Review",   detail:"Complete monthly branch review.",      cadence:"monthly", xp:180 },
  ],
  journey: [
    { key:"opened",   label:"Opened",       atLevel:1, detail:"First branch operational." },
    { key:"multi",    label:"Multi-Branch", atLevel:3, detail:"Multi-branch operation." },
    { key:"regional", label:"Regional",     atLevel:5, detail:"Region-wide network." },
  ],
  accent: "oklch(0.78 0.14 250)",
  gradient: "linear-gradient(120deg, oklch(0.24 0.04 260) 0%, oklch(0.3 0.12 250) 55%, oklch(0.38 0.16 240) 100%)",
};

const seo: AmsRoleConfig = {
  eyebrow: "SEO Journey",
  headline: "SEO Achievement Passport",
  subject: "SEO Expert",
  language: { performer: "SEO Expert", action: "rank", audience: "visitors", domain: "Search" },
  awards: [
    { key:"first-project",  label:"First Project",  requirement:"Create 1 project",       xp:100 },
    { key:"page-one",       label:"Page One",       requirement:"Rank a keyword top 10",  xp:250, visibleAtLevel:2 },
    { key:"top-three",      label:"Top Three",      requirement:"Rank top 3 on any KW",   xp:500, visibleAtLevel:3 },
    { key:"traffic-master", label:"Traffic Master", requirement:"100K organic sessions",  xp:800, visibleAtLevel:5 },
  ],
  badges: [
    { key:"verified-seo", label:"Verified SEO Expert", requirement:"Verified account",   xp:50 },
    { key:"first-audit",  label:"First Audit",         requirement:"Complete 1 audit",   xp:40 },
    { key:"100-keywords", label:"100 Keywords",        requirement:"Track 100 keywords", xp:200, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"rank-bronze", label:"Bronze Ranker", requirement:"Reach Level 2", xp:150 },
    { key:"rank-silver", label:"Silver Ranker", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"rank-gold",   label:"Gold Ranker",   requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
  ],
  certificates: [
    { key:"certified-seo", label:"Certified SEO Expert", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-audit",    label:"Daily Audit",   detail:"Run 1 audit today.",               cadence:"daily",   xp:20 },
    { key:"weekly-content", label:"Content Push",  detail:"Publish 1 SEO content this week.", cadence:"weekly",  xp:80 },
    { key:"monthly-report", label:"Client Report", detail:"Send monthly SEO reports.",        cadence:"monthly", xp:180 },
  ],
  journey: [
    { key:"kickoff",   label:"Kickoff",   atLevel:1, detail:"Projects created, keywords set." },
    { key:"ranking",   label:"Ranking",   atLevel:2, detail:"First keywords ranking." },
    { key:"scaling",   label:"Scaling",   atLevel:4, detail:"Multi-project, growing traffic." },
    { key:"authority", label:"Authority", atLevel:6, detail:"Recognised SEO authority." },
  ],
  accent: "oklch(0.8 0.18 140)",
  gradient: "linear-gradient(120deg, oklch(0.24 0.05 150) 0%, oklch(0.3 0.14 140) 55%, oklch(0.4 0.18 130) 100%)",
};

const admin: AmsRoleConfig = {
  eyebrow: "Operator Journey",
  headline: "Operator Achievement Passport",
  subject: "Operator",
  language: { performer: "Operator", action: "operate", audience: "platform", domain: "Operations" },
  awards: [
    { key:"first-approval", label:"First Approval", requirement:"Approve 1 request",   xp:60 },
    { key:"ops-hero",       label:"Ops Hero",       requirement:"Resolve 100 tickets", xp:400, visibleAtLevel:3 },
  ],
  badges: [
    { key:"verified-admin", label:"Verified Operator", requirement:"Verified account", xp:50 },
  ],
  trophies: [
    { key:"ops-bronze", label:"Bronze Operator", requirement:"Reach Level 2", xp:150 },
    { key:"ops-silver", label:"Silver Operator", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
  ],
  certificates: [
    { key:"platform-operator", label:"Platform Operator Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-triage", label:"Daily Triage", detail:"Clear the approval queue today.", cadence:"daily", xp:20 },
  ],
  journey: [
    { key:"on-duty", label:"On Duty", atLevel:1, detail:"Operating the platform." },
  ],
  accent: "oklch(0.78 0.2 25)",
  gradient: "linear-gradient(120deg, oklch(0.2 0.03 270) 0%, oklch(0.26 0.08 0) 55%, oklch(0.36 0.18 25) 100%)",
};

const developer: AmsRoleConfig = {
  eyebrow: "Developer Journey",
  headline: "Developer Achievement Passport",
  subject: "Developer",
  language: { performer: "Developer", action: "ship", audience: "team", domain: "Engineering" },
  awards: [
    { key:"first-commit",  label:"First Commit",   requirement:"Merge 1 PR",           xp:80 },
    { key:"bug-hunter",    label:"Bug Hunter",     requirement:"Close 50 bugs",        xp:400, visibleAtLevel:3 },
    { key:"ship-master",   label:"Ship Master",    requirement:"Ship 100 tasks",       xp:600, visibleAtLevel:4 },
  ],
  badges: [
    { key:"verified-dev",  label:"Verified Developer", requirement:"Complete profile",   xp:50 },
    { key:"clean-code",    label:"Clean Code",         requirement:"Zero-defect sprint", xp:120, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"dev-bronze", label:"Bronze Coder", requirement:"Reach Level 2", xp:150 },
    { key:"dev-silver", label:"Silver Coder", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
    { key:"dev-gold",   label:"Gold Coder",   requirement:"Reach Level 6", xp:900, visibleAtLevel:5 },
  ],
  certificates: [
    { key:"certified-dev", label:"Certified Developer", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-ship",    label:"Daily Ship",   detail:"Merge 1 PR today.",              cadence:"daily",   xp:20 },
    { key:"weekly-review", label:"Peer Review",  detail:"Review 5 PRs this week.",        cadence:"weekly",  xp:60 },
    { key:"monthly-bug",   label:"Bug Sweep",    detail:"Close 20 bugs this month.",      cadence:"monthly", xp:150 },
  ],
  journey: [
    { key:"onboard",  label:"Onboarding", atLevel:1, detail:"Dev environment ready." },
    { key:"shipping", label:"Shipping",   atLevel:2, detail:"Regular PR cadence." },
    { key:"leading",  label:"Leading",    atLevel:5, detail:"Mentoring, owning modules." },
  ],
  accent: "oklch(0.78 0.16 250)",
  gradient: "linear-gradient(120deg, oklch(0.24 0.05 260) 0%, oklch(0.30 0.14 250) 55%, oklch(0.40 0.18 230) 100%)",
};

const devManager: AmsRoleConfig = {
  eyebrow: "Dev Manager Journey",
  headline: "Manager Achievement Passport",
  subject: "Manager",
  language: { performer: "Manager", action: "orchestrate", audience: "engineering org", domain: "Delivery" },
  awards: [
    { key:"first-sprint",  label:"First Sprint Shipped", requirement:"Deliver 1 sprint on time", xp:120 },
    { key:"team-builder",  label:"Team Builder",         requirement:"Onboard 10 developers",     xp:400, visibleAtLevel:3 },
  ],
  badges: [
    { key:"verified-mgr",  label:"Verified Manager", requirement:"Verified account",   xp:50 },
    { key:"zero-esc",      label:"Zero Escalations", requirement:"Sprint with no escalations", xp:120, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"mgr-bronze", label:"Bronze Manager", requirement:"Reach Level 2", xp:150 },
    { key:"mgr-silver", label:"Silver Manager", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
  ],
  certificates: [
    { key:"delivery-lead", label:"Delivery Lead Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-standup", label:"Daily Standup", detail:"Run standup and update board.", cadence:"daily",  xp:20 },
    { key:"weekly-review", label:"Sprint Review", detail:"Close weekly review with team.", cadence:"weekly", xp:80 },
  ],
  journey: [
    { key:"forming",  label:"Forming",  atLevel:1, detail:"Team onboarding." },
    { key:"delivering", label:"Delivering", atLevel:3, detail:"Predictable sprints." },
    { key:"scaling",  label:"Scaling",  atLevel:5, detail:"Multi-squad orchestration." },
  ],
  accent: "oklch(0.80 0.16 200)",
  gradient: "linear-gradient(120deg, oklch(0.24 0.06 220) 0%, oklch(0.30 0.14 210) 55%, oklch(0.40 0.18 195) 100%)",
};

const promiseTracker: AmsRoleConfig = {
  eyebrow: "Promise Journey",
  headline: "Promise Keeper Passport",
  subject: "Promise Keeper",
  language: { performer: "Keeper", action: "fulfill", audience: "stakeholders", domain: "Commitments" },
  awards: [
    { key:"first-kept",   label:"First Promise Kept", requirement:"Fulfill 1 promise",      xp:80 },
    { key:"streak-100",   label:"100-Streak",         requirement:"100 promises on time",   xp:500, visibleAtLevel:4 },
  ],
  badges: [
    { key:"verified-keeper", label:"Verified Keeper", requirement:"Verified account", xp:50 },
    { key:"no-broken",       label:"Zero Broken",     requirement:"No broken promises in 30 days", xp:150, visibleAtLevel:2 },
  ],
  trophies: [
    { key:"pt-bronze", label:"Bronze Keeper", requirement:"Reach Level 2", xp:150 },
    { key:"pt-silver", label:"Silver Keeper", requirement:"Reach Level 4", xp:400, visibleAtLevel:3 },
  ],
  certificates: [
    { key:"sla-champion", label:"SLA Champion Certificate", requirement:"Verified profile", xp:0 },
  ],
  missions: [
    { key:"daily-check", label:"Daily Check-In", detail:"Review active promises today.",    cadence:"daily",   xp:20 },
    { key:"weekly-close",label:"Weekly Closeout",detail:"Close 10 fulfilled promises.",     cadence:"weekly",  xp:80 },
  ],
  journey: [
    { key:"pledge",   label:"Pledge",   atLevel:1, detail:"First promises registered." },
    { key:"tracking", label:"Tracking", atLevel:2, detail:"Active SLA discipline." },
    { key:"champion", label:"Champion", atLevel:5, detail:"Recognised promise keeper." },
  ],
  accent: "oklch(0.80 0.18 340)",
  gradient: "linear-gradient(120deg, oklch(0.24 0.06 320) 0%, oklch(0.30 0.14 330) 55%, oklch(0.40 0.20 350) 100%)",
};

export const AMS_ROLE: Record<RoleKey, AmsRoleConfig> = {
  author, reseller, vendor, affiliate, influencer, franchise, seo, admin,
  developer, "dev-manager": devManager, "promise-tracker": promiseTracker,
};

export type AmsUserState = {
  xp: number;
  earnedAwards: string[];
  earnedBadges: string[];
  earnedTrophies: string[];
  earnedCertificates: string[];
  earnedMissions: string[];
  claimedRewards: string[];
  passportId: string;
  joinedAt: string;
  trustScore: number;
  reputation: number;
  verified: boolean;
};

const LS_KEY = (role: RoleKey) => `sv.ams.${role}.v1`;

function fresh(role: RoleKey): AmsUserState {
  const seed = role.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const id = `SV-AMS-${String(2000 + seed).padStart(4, "0")}-${String((seed * 137) % 10000).padStart(4, "0")}`;
  return {
    xp: 0,
    earnedAwards: [], earnedBadges: [], earnedTrophies: [],
    earnedCertificates: [], earnedMissions: [], claimedRewards: [],
    passportId: id, joinedAt: new Date().toISOString(),
    trustScore: 0, reputation: 0, verified: false,
  };
}

export function loadAmsState(role: RoleKey): AmsUserState {
  if (typeof window === "undefined") return fresh(role);
  try {
    const raw = window.localStorage.getItem(LS_KEY(role));
    if (!raw) return fresh(role);
    return { ...fresh(role), ...(JSON.parse(raw) as Partial<AmsUserState>) };
  } catch {
    return fresh(role);
  }
}

export function saveAmsState(role: RoleKey, s: AmsUserState) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(LS_KEY(role), JSON.stringify(s)); } catch { /* ignore */ }
}

export function sectionsForLevel(level: number) {
  return AMS_SECTIONS.map((s) => ({ ...s, unlocked: level >= s.unlockLevel }));
}
