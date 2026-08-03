import {
  Activity, Award, BadgeCheck, BarChart3, Banknote, Bot, Boxes, Building2, Calendar,
  ClipboardCheck, Coins, CreditCard, FileSignature, FileText, Flag, Gauge, Globe2,
  GraduationCap, Handshake, HeartHandshake, Inbox, Layers, LayoutDashboard, Map,
  Megaphone, MessagesSquare, Package, Percent, Receipt, RefreshCcw, Scale, Settings,
  ShieldCheck, ShoppingBag, Sparkles, Store, Target, TrendingUp, Trophy, UserCheck,
  UserPlus, Users, Wallet,
} from "lucide-react";

import type { NavGroup, NavItem } from "@/components/creator/navigation";

export const franchisePrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Franchise Directory", icon: Store },
  { label: "Applications", icon: ClipboardCheck },
  { label: "Revenue", icon: TrendingUp },
  { label: "AI Studio", icon: Sparkles },
];

export const franchiseGroups: NavGroup[] = [
  {
    label: "Franchise Manager",
    items: [
      { label: "Command Console", icon: Gauge },
      { label: "Franchise Directory", icon: Store },
      { label: "Applications", icon: ClipboardCheck },
      { label: "Onboarding", icon: UserPlus },
      { label: "License", icon: BadgeCheck },
      { label: "Renewals", icon: RefreshCcw },
      { label: "Tiers & Levels", icon: Layers },
      { label: "Performance Review", icon: Gauge },
      { label: "Compliance", icon: Scale },
    ],
  },
  {
    label: "Territory",
    items: [
      { label: "Countries", icon: Flag },
      { label: "Regions", icon: Globe2 },
      { label: "Territory Map", icon: Map },
      { label: "Master Franchise", icon: Building2 },
      { label: "Expansion Planner", icon: Target },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Products", icon: Package },
      { label: "Catalog", icon: Boxes },
      { label: "Orders", icon: ShoppingBag },
      { label: "Marketing", icon: Megaphone },
      { label: "Leads", icon: Target },
      { label: "Marketplace", icon: Store },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Revenue", icon: TrendingUp },
      { label: "Royalty", icon: Coins },
      { label: "Commission", icon: Percent },
      { label: "Invoices", icon: Receipt },
      { label: "Payouts", icon: Banknote },
      { label: "Wallet", icon: Wallet },
      { label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Legal", icon: Scale },
      { label: "Contracts", icon: FileSignature },
      { label: "Documents", icon: FileText },
      { label: "Approvals", icon: ClipboardCheck },
      { label: "Audit Trail", icon: ShieldCheck },
      { label: "Users & Roles", icon: Users },
      { label: "Verification", icon: UserCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Training", icon: GraduationCap },
      { label: "Support", icon: HeartHandshake },
      { label: "Communication", icon: MessagesSquare },
      { label: "Notifications", icon: Activity },
      { label: "Inbox", icon: Inbox },
      { label: "Partner Relations", icon: Handshake },
      { label: "Calendar", icon: Calendar },
      { label: "Settings", icon: Settings },
    ],
  },
  {
    label: "Rank & Awards",
    items: [
      { label: "Leaderboard", icon: Trophy },
      { label: "Achievements", icon: Award },
      { label: "Hall of Fame", icon: Trophy },
    ],
  },
  {
    label: "AI & Insights",
    items: [
      { label: "AI Studio", icon: Sparkles },
      { label: "AI Chat", icon: Bot },
      { label: "Analytics", icon: BarChart3 },
      { label: "Reports", icon: BarChart3 },
    ],
  },
];
