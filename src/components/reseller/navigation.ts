import {
  Activity, Award, BadgeCheck, BarChart3, Banknote, Bot, Boxes, Building2, Calendar,
  ClipboardCheck, Coins, CreditCard, FileSignature, FileText, Gauge, Gift, Globe,
  GraduationCap, Handshake, HeartHandshake, Inbox, Layers, LayoutDashboard, Link2,
  ListChecks, Map, Megaphone, MessagesSquare, Package, Percent, QrCode, Receipt,
  RefreshCcw, Scale, Settings, ShieldCheck, ShoppingBag, Sparkles, Store, Target,
  Ticket, TrendingUp, Trophy, Truck, UserCheck, UserPlus, Users, Wallet, Warehouse,
} from "lucide-react";

import type { NavGroup, NavItem } from "@/components/creator/navigation";

export const resellerPrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Resellers", icon: Users },
  { label: "Orders", icon: ShoppingBag },
  { label: "Catalog", icon: Package },
  { label: "AI Studio", icon: Sparkles },
];

export const resellerGroups: NavGroup[] = [
  {
    label: "Reseller Manager",
    items: [
      { label: "Command Console", icon: Gauge },
      { label: "Reseller Directory", icon: Users },
      { label: "Applications", icon: UserCheck },
      { label: "Onboarding", icon: UserPlus },
      { label: "Tiers & Levels", icon: Layers },
      { label: "Territories", icon: Map },
      { label: "Assignments", icon: ListChecks },
      { label: "Performance Review", icon: Gauge },
      { label: "Compliance", icon: Scale },
      { label: "Manager Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Sell",
    items: [
      { label: "Catalog", icon: Package },
      { label: "Products", icon: Boxes },
      { label: "Price Books", icon: Receipt },
      { label: "Quotes", icon: FileText },
      { label: "Deal Registration", icon: FileSignature },
      { label: "Orders", icon: ShoppingBag },
      { label: "Subscriptions", icon: RefreshCcw },
      { label: "Renewals", icon: RefreshCcw },
      { label: "Fulfilment", icon: Truck },
      { label: "Inventory", icon: Warehouse },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { label: "Leads", icon: Target },
      { label: "Opportunities", icon: TrendingUp },
      { label: "Customers", icon: Users },
      { label: "Accounts", icon: Building2 },
      { label: "Marketplace", icon: Store },
      { label: "Campaigns", icon: Megaphone },
      { label: "Coupons", icon: Ticket },
      { label: "Referral Links", icon: Link2 },
      { label: "QR Center", icon: QrCode },
    ],
  },
  {
    label: "Finance",
    items: [
      { label: "Revenue", icon: TrendingUp },
      { label: "Commission Rules", icon: Percent },
      { label: "Commission Ledger", icon: Coins },
      { label: "Invoices", icon: Receipt },
      { label: "Payouts", icon: Banknote },
      { label: "Wallet", icon: Wallet },
      { label: "Withdrawals", icon: CreditCard },
      { label: "Tax & Billing", icon: FileText },
    ],
  },
  {
    label: "Partner Success",
    items: [
      { label: "Support Desk", icon: HeartHandshake },
      { label: "Tickets", icon: Inbox },
      { label: "Communication", icon: MessagesSquare },
      { label: "Notifications", icon: Activity },
      { label: "Partner Portal", icon: Globe },
      { label: "Co-Marketing", icon: Handshake },
      { label: "Enablement", icon: GraduationCap },
      { label: "Certification", icon: BadgeCheck },
      { label: "Academy", icon: GraduationCap },
    ],
  },
  {
    label: "Rank & Rewards",
    items: [
      { label: "Leaderboard", icon: Trophy },
      { label: "Achievements", icon: Award },
      { label: "Incentives", icon: Gift },
      { label: "Challenges", icon: Target },
      { label: "Hall of Fame", icon: Trophy },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Contracts", icon: FileSignature },
      { label: "Documents", icon: FileText },
      { label: "KYC & Verification", icon: BadgeCheck },
      { label: "Approvals", icon: ClipboardCheck },
      { label: "Audit Trail", icon: ShieldCheck },
      { label: "Legal", icon: Scale },
    ],
  },
  {
    label: "AI & Insights",
    items: [
      { label: "AI Studio", icon: Sparkles },
      { label: "AI Chat", icon: Bot },
      { label: "Analytics", icon: BarChart3 },
      { label: "Forecasting", icon: TrendingUp },
      { label: "Reports", icon: BarChart3 },
      { label: "Calendar", icon: Calendar },
      { label: "Settings", icon: Settings },
    ],
  },
];
