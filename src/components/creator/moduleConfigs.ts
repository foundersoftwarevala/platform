import {
  BadgeCheck, BarChart3, Building2, Coins, Eye, Flag, Globe2, Handshake, Heart, Layout,
  Megaphone, MousePointerClick, Package, RefreshCcw, ShoppingBag, Store, Target,
  TrendingUp, Trophy, Users, Wallet,
} from "lucide-react";

import type { ModuleConfig } from "./ModuleDashboard";
import { groups as creatorGroups, primary as creatorPrimary } from "./navigation";
import { resellerGroups, resellerPrimary } from "@/components/reseller/navigation";
import { influencerGroups, influencerPrimary } from "@/components/influencer/navigation";
import { franchiseGroups, franchisePrimary } from "@/components/franchise/navigation";
import { marketplaceGroups, marketplacePrimary } from "@/components/marketplace-manager/navigation";

export const creatorConfig: ModuleConfig = {
  id: "creator",
  brand: "Software Vala",
  brandMark: "SV",
  eyebrow: "Software Vala Creator Program",
  title: "Creator Manager",
  subtitle:
    "Onboard creators, run campaigns, approve content and track commissions — all from one manager console.",
  primary: creatorPrimary,
  groups: creatorGroups,
  defaultModule: "Manager Console",
  kpis: [
    { key: "followers", label: "Followers", icon: Users, tint: "text-accent-pink" },
    { key: "reach", label: "Reach", icon: TrendingUp, tint: "text-primary-glow" },
    { key: "views", label: "Views", icon: Eye, tint: "text-accent-emerald" },
    { key: "clicks", label: "Clicks", icon: MousePointerClick, tint: "text-accent-amber" },
    { key: "leads", label: "Leads", icon: Target, tint: "text-accent-pink" },
    { key: "sales", label: "Sales", icon: ShoppingBag, tint: "text-primary-glow" },
    { key: "commissions", label: "Commission", icon: Wallet, tint: "text-accent-emerald" },
  ],
  primaryCta: { label: "Launch a Campaign", target: "Campaigns" },
  secondaryCta: { label: "Ask AI", target: "AI Chat" },
  profile: {
    title: "Manager Profile",
    caption: "Connect Software Vala login",
    stats: [
      ["Creators", "—"],
      ["Rank", "—"],
      ["Streak", "0d"],
    ],
  },
  plan: [
    ["Review creator content", "Approval queue", "9:00 AM"],
    ["Campaign stand-up", "Marketing", "12:30 PM"],
    ["Payout approvals", "Finance", "6:00 PM"],
    ["Creator support desk", "All channels", "9:00 PM"],
  ],
  balance: {
    label: "Commission balance",
    key: "commissions",
    action: "Open wallet",
    target: "Wallet",
  },
  walls: [
    {
      title: "Live Campaigns",
      icon: Megaphone,
      tint: "text-primary-glow",
      action: "View all",
      target: "Campaigns",
      empty: "No campaigns yet. Browse Marketplace to launch your first.",
    },
    {
      title: "Top Products",
      icon: Package,
      tint: "text-accent-pink",
      action: "View all",
      target: "Products",
      empty: "Products from the Marketplace will appear here.",
    },
  ],
  leaderboardEmpty: "Awaiting creators",
  suggestions: [
    "Post a Reel about your top product tonight at 8 PM for peak reach.",
    "Audience engagement is highest on Saturday — schedule a story.",
    "Try a 15s testimonial Short — converts 2.4× better than long form.",
  ],
};

export const resellerConfig: ModuleConfig = {
  id: "reseller",
  brand: "Reseller Command",
  brandMark: "RC",
  eyebrow: "Software Vala Partner Network",
  title: "Reseller Manager",
  subtitle:
    "Recruit resellers, register deals, ship orders and settle commission — one command center for the whole partner channel.",
  primary: resellerPrimary,
  groups: resellerGroups,
  defaultModule: "Command Console",
  kpis: [
    { key: "resellers", label: "Resellers", icon: Users, tint: "text-accent-pink" },
    { key: "leads", label: "Leads", icon: Target, tint: "text-primary-glow" },
    { key: "orders", label: "Orders", icon: ShoppingBag, tint: "text-accent-emerald" },
    { key: "revenue", label: "Revenue", icon: TrendingUp, tint: "text-accent-amber" },
    { key: "renewals", label: "Renewals", icon: RefreshCcw, tint: "text-accent-pink" },
    { key: "tickets", label: "Tickets", icon: Heart, tint: "text-primary-glow" },
    { key: "commissions", label: "Commission", icon: Coins, tint: "text-accent-emerald" },
  ],
  primaryCta: { label: "Register a Deal", target: "Deal Registration" },
  secondaryCta: { label: "Ask AI", target: "AI Chat" },
  profile: {
    title: "Channel Profile",
    caption: "Connect Software Vala login",
    stats: [
      ["Partners", "—"],
      ["Tier", "—"],
      ["Streak", "0d"],
    ],
  },
  plan: [
    ["Approve partner applications", "Onboarding", "9:00 AM"],
    ["Deal-desk review", "Pipeline", "12:30 PM"],
    ["Commission run", "Finance", "6:00 PM"],
    ["Partner support desk", "All channels", "9:00 PM"],
  ],
  balance: {
    label: "Commission payable",
    key: "commissions",
    action: "Open ledger",
    target: "Commission Ledger",
  },
  walls: [
    {
      title: "Open Deals",
      icon: Handshake,
      tint: "text-primary-glow",
      action: "View all",
      target: "Deal Registration",
      empty: "No registered deals yet. Partners' deals appear here once submitted.",
    },
    {
      title: "Top Resellers",
      icon: Store,
      tint: "text-accent-pink",
      action: "View all",
      target: "Reseller Directory",
      empty: "Reseller ranking appears after the first booked order.",
    },
  ],
  leaderboardEmpty: "Awaiting resellers",
  suggestions: [
    "3 partner tiers have no active deal this quarter — trigger an enablement nudge.",
    "Renewals cluster in the next 30 days — pre-stage renewal quotes now.",
    "Deals with a registered lead close 1.8× faster — enforce registration.",
  ],
};

export const influencerConfig: ModuleConfig = {
  id: "influencer",
  brand: "Influencer Panel",
  brandMark: "IP",
  eyebrow: "Software Vala Influencer Network",
  title: "Influencer Manager",
  subtitle:
    "Recruit influencers, match brands, approve content and settle commissions across the whole creator network.",
  primary: influencerPrimary,
  groups: influencerGroups,
  defaultModule: "Manager Console",
  kpis: [
    { key: "influencers", label: "Influencers", icon: Users, tint: "text-accent-pink" },
    { key: "applications", label: "Applications", icon: BadgeCheck, tint: "text-primary-glow" },
    { key: "campaigns", label: "Campaigns", icon: Megaphone, tint: "text-accent-emerald" },
    { key: "reach", label: "Reach", icon: TrendingUp, tint: "text-accent-amber" },
    { key: "leads", label: "Leads", icon: Target, tint: "text-accent-pink" },
    { key: "sales", label: "Sales", icon: ShoppingBag, tint: "text-primary-glow" },
    { key: "commissions", label: "Commission", icon: Wallet, tint: "text-accent-emerald" },
  ],
  primaryCta: { label: "Create a Campaign", target: "Campaigns" },
  secondaryCta: { label: "Ask AI", target: "AI Chat" },
  profile: {
    title: "Network Profile",
    caption: "Connect Software Vala login",
    stats: [
      ["Influencers", "—"],
      ["Rank", "—"],
      ["Streak", "0d"],
    ],
  },
  plan: [
    ["Screen new applications", "KYC queue", "9:00 AM"],
    ["Brand matching review", "Campaigns", "12:30 PM"],
    ["Payout approvals", "Finance", "6:00 PM"],
    ["Influencer support desk", "All channels", "9:00 PM"],
  ],
  balance: {
    label: "Commission payable",
    key: "commissions",
    action: "Open wallet",
    target: "Wallet",
  },
  walls: [
    {
      title: "Live Campaigns",
      icon: Megaphone,
      tint: "text-primary-glow",
      action: "View all",
      target: "Campaigns",
      empty: "No campaigns yet. Brands' campaigns appear here once published.",
    },
    {
      title: "Partner Brands",
      icon: Building2,
      tint: "text-accent-pink",
      action: "View all",
      target: "Brands",
      empty: "Brand directory populates after the first brand onboarding.",
    },
  ],
  leaderboardEmpty: "Awaiting influencers",
  suggestions: [
    "Applications older than 72h risk drop-off — clear the KYC queue today.",
    "Micro-influencers convert 2.1× better for coupon campaigns.",
    "Pair top-reach creators with the newest brand for a launch push.",
  ],
};

export const franchiseConfig: ModuleConfig = {
  id: "franchise",
  brand: "Franchise Command",
  brandMark: "FC",
  eyebrow: "Software Vala Global Franchise",
  title: "Franchise Manager",
  subtitle:
    "Run applications, licenses, territories, royalty and compliance for every franchise, country and region.",
  primary: franchisePrimary,
  groups: franchiseGroups,
  defaultModule: "Command Console",
  kpis: [
    { key: "franchises", label: "Franchises", icon: Store, tint: "text-accent-pink" },
    { key: "applications", label: "Applications", icon: BarChart3, tint: "text-primary-glow" },
    { key: "countries", label: "Countries", icon: Flag, tint: "text-accent-emerald" },
    { key: "regions", label: "Regions", icon: Globe2, tint: "text-accent-amber" },
    { key: "licenses", label: "Licenses", icon: BadgeCheck, tint: "text-accent-pink" },
    { key: "revenue", label: "Revenue", icon: TrendingUp, tint: "text-primary-glow" },
    { key: "royalty", label: "Royalty", icon: Coins, tint: "text-accent-emerald" },
  ],
  primaryCta: { label: "Review Applications", target: "Applications" },
  secondaryCta: { label: "Ask AI", target: "AI Chat" },
  profile: {
    title: "Network Profile",
    caption: "Connect Software Vala login",
    stats: [
      ["Franchises", "—"],
      ["Countries", "—"],
      ["Streak", "0d"],
    ],
  },
  plan: [
    ["Approve franchise applications", "Pipeline", "9:00 AM"],
    ["License renewal review", "Licensing", "12:30 PM"],
    ["Royalty settlement", "Finance", "6:00 PM"],
    ["Regional partner desk", "All channels", "9:00 PM"],
  ],
  balance: {
    label: "Royalty due",
    key: "royalty",
    action: "Open revenue",
    target: "Revenue",
  },
  walls: [
    {
      title: "Application Pipeline",
      icon: Trophy,
      tint: "text-primary-glow",
      action: "View all",
      target: "Applications",
      empty: "No applications yet. Incoming franchise leads appear here.",
    },
    {
      title: "Franchise Directory",
      icon: Store,
      tint: "text-accent-pink",
      action: "View all",
      target: "Franchise Directory",
      empty: "Active franchises appear here once licensing completes.",
    },
  ],
  leaderboardEmpty: "Awaiting franchises",
  suggestions: [
    "Licenses expiring within 60 days should enter the renewal workflow now.",
    "Regions without a master franchise are the highest-value expansion targets.",
    "Compliance gaps block royalty settlement — clear open findings first.",
  ],
};
