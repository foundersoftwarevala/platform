// Marketplace Manager navigation — full feature registry ported from the
// Software Vala marketplace manager, expressed in this project's manager-console
// nav shape so the UI/UX matches Franchise Manager exactly.

import {
  Video,
  Bell, BellRing, BarChart3, Bookmark, Bot, CheckCheck, ClipboardCheck, Clock,
  Cpu, CreditCard, DollarSign, Download, FileText, Filter, Fingerprint,
  FolderOpen, FolderTree, Globe2, Handshake, HelpCircle, History,
  Image as ImageIcon, KeyRound, Layout, LayoutDashboard, LayoutGrid, LifeBuoy,
  Link2, Mail, Megaphone, Menu, MonitorPlay, MousePointerClick, Newspaper,
  Package, PanelBottom, PenTool, Phone, Pin, Plug, Rocket, ScanLine, Search,
  Server, Settings, ShieldCheck, ShoppingBag, Sparkles, Star, Store, Tag,
  Target, Users, Users2, Wrench, Zap, QrCode,
} from "lucide-react";

import type { NavGroup, NavItem } from "@/components/creator/navigation";

export const marketplacePrimary: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Products", icon: Package },
  { label: "Orders", icon: ShoppingBag },
  { label: "Homepage Rows", icon: Layout },
  { label: "AI Recs", icon: Sparkles },
];

export const marketplaceGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard },
      { label: "Analytics", icon: BarChart3 },
      { label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Homepage",
    items: [
      { label: "Top Bar", icon: Menu },
      { label: "Storefront Bar", icon: Menu },
      { label: "Hero Banner", icon: ImageIcon },
      { label: "Homepage Rows", icon: Layout },
      { label: "Layout Order", icon: Layout },
      { label: "Walls", icon: LayoutGrid },
      { label: "Placement", icon: Target },
      { label: "Sticky", icon: Pin },
      { label: "Footer", icon: PanelBottom },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Categories", icon: FolderTree },
      { label: "Products", icon: Package },
      { label: "Product Content", icon: FileText },
      { label: "Product Media", icon: ImageIcon },
      { label: "Card Manager", icon: CreditCard },
      { label: "Cards", icon: CreditCard },
      { label: "Filters", icon: Filter },
      { label: "Demo System", icon: MonitorPlay },
    ],
  },
  {
    label: "Commerce",
    items: [
      { label: "Pricing", icon: DollarSign },
      { label: "Orders", icon: ShoppingBag },
      { label: "Payments", icon: CreditCard },
      { label: "License", icon: KeyRound },
      { label: "Downloads", icon: Download },
      { label: "Releases", icon: Rocket },
      { label: "Customers", icon: Users },
      { label: "Offers", icon: Tag },
      { label: "Popups", icon: BellRing },
      { label: "Upcoming", icon: Clock },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Marketing", icon: Mail },
      { label: "SEO", icon: Globe2 },
      { label: "Search", icon: Search },
      { label: "AI Recs", icon: Sparkles },
      { label: "Notifications", icon: Bell },
      { label: "Blog", icon: Newspaper },
      { label: "Vala TV", icon: Video },
      { label: "Partners", icon: Users2 },
      { label: "Affiliate", icon: Link2 },
      { label: "Influencer", icon: Megaphone },
      { label: "Authors", icon: PenTool },
      { label: "Vendors", icon: Store },
      { label: "Resellers", icon: Handshake },
      { label: "Reviews", icon: Star },
      { label: "Trust", icon: ShieldCheck },
      { label: "FAQ", icon: HelpCircle },
      { label: "Contact", icon: Phone },
      { label: "QR System", icon: QrCode },
    ],
  },
  {
    label: "Governance",
    items: [
      { label: "Author Approval", icon: ClipboardCheck },
      { label: "Moderation", icon: ShieldCheck },
      { label: "Quality Gate", icon: CheckCheck },
      { label: "Upload Scanner", icon: ScanLine },
      { label: "Brand Protect", icon: Fingerprint },
      { label: "Demo Domain", icon: Globe2 },
      { label: "Demo Sandbox", icon: MonitorPlay },
      { label: "Product URLs", icon: Link2 },
      { label: "SEO Automation", icon: Sparkles },
      { label: "AI Content", icon: Bot },
      { label: "Leads", icon: Phone },
      { label: "Product Analytics", icon: BarChart3 },
      { label: "Audit & History", icon: History },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Actions", icon: MousePointerClick },
      { label: "Action Toolkit", icon: Wrench },
      { label: "Automation", icon: Zap },
      { label: "Micro-Features", icon: Zap },
      { label: "Media Library", icon: FolderOpen },
      { label: "AI Providers", icon: Cpu },
      { label: "API", icon: Plug },
      { label: "Integrations", icon: Plug },
      { label: "Deployment", icon: Rocket },
      { label: "Integrity", icon: ShieldCheck },
      { label: "Security", icon: ShieldCheck },
      { label: "System", icon: Server },
      { label: "Support", icon: LifeBuoy },
      { label: "Extra", icon: Bookmark },
      { label: "Settings", icon: Settings },
    ],
  },
];
