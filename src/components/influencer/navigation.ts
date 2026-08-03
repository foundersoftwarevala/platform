import {
  Activity, Album, Award, BadgeCheck, BarChart3, Banknote, Bot, Building2, Calendar,
  CalendarDays, ClipboardCheck, Coins, CreditCard, FileSignature, FileText, Gauge,
  Gift, Handshake, HeartHandshake, Image as ImageIcon, Inbox, Layers, LayoutDashboard,
  Link2, ListChecks, Megaphone, MessagesSquare, Package, Percent, QrCode, Receipt,
  RefreshCcw, Scale, Settings, ShieldCheck, ShoppingBag, Sparkles, Star, Store, Target,
  Ticket, TrendingUp, Trophy, UserCheck, UserPlus, Users, UsersRound, Wallet,
} from "lucide-react";

import type { NavGroup, NavItem } from "@/components/creator/navigation";

export const influencerPrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Influencers", icon: Users },
  { label: "Campaigns", icon: Megaphone },
  { label: "Commissions", icon: Wallet },
  { label: "AI Studio", icon: Sparkles },
];

export const influencerGroups: NavGroup[] = [
  {
    label: "Influencer Manager",
    items: [
      { label: "Manager Console", icon: UsersRound },
      { label: "Influencers", icon: Users },
      { label: "Creator Profiles", icon: UserCheck },
      { label: "Applications", icon: ClipboardCheck },
      { label: "Onboarding", icon: UserPlus },
      { label: "Assignments", icon: ListChecks },
      { label: "Verification", icon: BadgeCheck },
      { label: "Compliance", icon: Scale },
      { label: "Performance", icon: Gauge },
      { label: "Tiers & Levels", icon: Layers },
    ],
  },
  {
    label: "Campaigns",
    items: [
      { label: "Campaigns", icon: Megaphone },
      { label: "Brands", icon: Building2 },
      { label: "Collaborations", icon: Handshake },
      { label: "Marketplace Promotions", icon: Store },
      { label: "Coupons", icon: Ticket },
      { label: "Content Calendar", icon: CalendarDays },
      { label: "Contracts", icon: FileSignature },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Content Library", icon: Album },
      { label: "Media Assets", icon: ImageIcon },
      { label: "Content Approval", icon: ClipboardCheck },
      { label: "Reviews", icon: Star },
      { label: "Social Accounts", icon: BadgeCheck },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Leads", icon: Target },
      { label: "Customers", icon: Users },
      { label: "Sales", icon: ShoppingBag },
      { label: "Affiliate Links", icon: Link2 },
      { label: "Referral Links", icon: Link2 },
      { label: "QR Center", icon: QrCode },
      { label: "Analytics", icon: BarChart3 },
      { label: "Performance Insights", icon: TrendingUp },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Commissions", icon: Coins },
      { label: "Commission Rules", icon: Percent },
      { label: "Wallet", icon: Wallet },
      { label: "Payouts", icon: Banknote },
      { label: "Withdrawals", icon: CreditCard },
      { label: "Invoices", icon: Receipt },
      { label: "Subscriptions", icon: RefreshCcw },
    ],
  },
  {
    label: "Rank & Rewards",
    items: [
      { label: "Leaderboard", icon: Trophy },
      { label: "Achievements", icon: Award },
      { label: "Rewards", icon: Gift },
      { label: "Challenges", icon: Target },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Communication", icon: MessagesSquare },
      { label: "Notifications", icon: Activity },
      { label: "Inbox", icon: Inbox },
      { label: "Support", icon: HeartHandshake },
      { label: "Documents", icon: FileText },
      { label: "Audit Trail", icon: ShieldCheck },
      { label: "Reports", icon: BarChart3 },
      { label: "Products", icon: Package },
      { label: "Calendar", icon: Calendar },
      { label: "Settings", icon: Settings },
    ],
  },
  {
    label: "AI",
    items: [
      { label: "AI Studio", icon: Sparkles },
      { label: "AI Chat", icon: Bot },
      { label: "Brand Matching AI", icon: Sparkles },
      { label: "Reports Builder", icon: BarChart3 },
    ],
  },
];
