import {
  Activity,
  Award,
  Banknote,
  BarChart3,
  Building2,
  Calendar,
  ClipboardCheck,
  FileText,
  Globe,
  Handshake,
  HeartHandshake,
  Link2,
  Lock,
  Map,
  Megaphone,
  Package,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  Trophy,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import type { NavGroup, NavItem } from "@/components/creator/navigation";

export const affiliatePrimary: NavItem[] = [
  { label: "Dashboard", icon: Activity },
  { label: "Affiliates", icon: Users },
  { label: "Referrals", icon: Link2 },
  { label: "Payouts", icon: Wallet },
  { label: "Analytics", icon: BarChart3 },
];

export const affiliateGroups: NavGroup[] = [
  {
    label: "Affiliate Manager",
    items: [
      { label: "Affiliate Console", icon: Activity },
      { label: "Affiliate Directory", icon: Users },
      { label: "Referral Links", icon: Link2 },
      { label: "Referral Codes", icon: FileText },
      { label: "Commission Rules", icon: Scale },
      { label: "Payouts", icon: Wallet },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Campaigns", icon: Megaphone },
      { label: "Marketplace", icon: Store },
      { label: "Partner Offers", icon: Handshake },
      { label: "Performance", icon: Trophy },
      { label: "Conversion", icon: TrendingUp },
    ],
  },
  {
    label: "Partner Success",
    items: [
      { label: "Support Desk", icon: HeartHandshake },
      { label: "Documents", icon: FileText },
      { label: "Compliance", icon: ShieldCheck },
      { label: "Audit Trail", icon: ClipboardCheck },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Wallet", icon: Banknote },
      { label: "Invoices", icon: FileText },
      { label: "Payments", icon: Globe },
      { label: "Billing", icon: Building2 },
    ],
  },
  {
    label: "AI & Insights",
    items: [
      { label: "AI Studio", icon: Sparkles },
      { label: "Reports", icon: BarChart3 },
      { label: "Forecasting", icon: Calendar },
      { label: "Settings", icon: Lock },
    ],
  },
];
