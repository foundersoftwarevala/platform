import {
  Activity,
  Brain,
  Calendar,
  CheckCircle,
  FileText,
  Gift,
  Image,
  Layers,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Search,
  Shield,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MarketingNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export type MarketingNavGroup = {
  label: string;
  items: MarketingNavItem[];
};

/** Always-visible entries, pinned above the grouped modules. */
export const marketingPrimary: MarketingNavItem[] = [
  { to: "/marketing", label: "Overview", icon: LayoutDashboard },
  { to: "/marketing/campaigns", label: "Campaigns", icon: Megaphone },
];

export const marketingGroups: MarketingNavGroup[] = [
  {
    label: "Plan & Build",
    items: [
      { to: "/marketing/campaign-builder", label: "Campaign Builder", icon: Target },
      { to: "/marketing/hierarchy", label: "Campaign Hierarchy", icon: Layers },
      { to: "/marketing/schedules", label: "Schedules", icon: Calendar },
      { to: "/marketing/targeting", label: "Location Targeting", icon: MapPin },
    ],
  },
  {
    label: "Content & Demand",
    items: [
      { to: "/marketing/content", label: "Content Library", icon: Image },
      { to: "/marketing/creatives", label: "Creatives Library", icon: Image },
      { to: "/marketing/offers", label: "Offers & Festivals", icon: Gift },
      { to: "/marketing/seo", label: "SEO Management", icon: Search },
      { to: "/marketing/lead-sources", label: "Lead Sources", icon: Users },
    ],
  },
  {
    label: "Measure",
    items: [
      { to: "/marketing/performance", label: "Performance", icon: Activity },
      { to: "/marketing/analytics", label: "ROI Analytics", icon: TrendingUp },
      { to: "/marketing/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Govern",
    items: [
      { to: "/marketing/ai-automation", label: "AI Automation", icon: Brain },
      { to: "/marketing/approvals", label: "Approvals", icon: CheckCircle },
      { to: "/marketing/audit", label: "Audit", icon: Shield },
    ],
  },
];

/** Flat list, still used for breadcrumbs and the mobile rail. */
export const marketingNav: MarketingNavItem[] = [
  ...marketingPrimary,
  ...marketingGroups.flatMap((g) => g.items),
];
