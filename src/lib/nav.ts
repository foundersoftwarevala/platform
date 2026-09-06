/**
 * AMS navigation — the same model as the reference AMS application, with every
 * address moved under /ams because that is where Software Vala mounts the
 * module. Groups, order, labels, icons and the longest-prefix active match are
 * unchanged, so the navigation behaves exactly as it does in the reference.
 */
import {
  LayoutDashboard, UsersRound, BookMarked, Fingerprint, Trophy, Award, Shield,
  Ribbon, CreditCard, Crown, Zap, ArrowUpCircle, Target, Gift, BarChart3, Star,
  Archive, Layers, LineChart, Settings, Bell, ScrollText, Sparkles, MessageSquare,
  Landmark, Coins, Gem, Package, Medal, IdCard, FileBadge, Stamp, ShieldCheck,
  Swords, Flag, Ticket, Building2,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavGroup = { label: string; items: NavItem[] };

/** Always-visible top-level entries. */
export const primaryNav: NavItem[] = [
  { to: "/ams/overview", label: "Command Center", icon: LayoutDashboard },
  { to: "/ams/tickets", label: "AMS Tickets", icon: Ticket },
];

export const navGroups: NavGroup[] = [
  {
    label: "Identity",
    items: [
      { to: "/ams/role-manager", label: "Role Manager", icon: UsersRound },
      { to: "/ams/passport", label: "Passport", icon: BookMarked },
      { to: "/ams/identity", label: "Identity", icon: Fingerprint },
    ],
  },
  {
    label: "Recognition",
    items: [
      { to: "/ams/achievements", label: "Achievements", icon: Trophy },
      { to: "/ams/awards", label: "Awards", icon: Award },
      { to: "/ams/badges", label: "Badges", icon: Shield },
      { to: "/ams/trophies", label: "Trophies", icon: Trophy },
      { to: "/ams/certificates", label: "Certificates", icon: Ribbon },
      { to: "/ams/hall-of-fame", label: "Hall of Fame", icon: Star },
      { to: "/ams/legacy", label: "Legacy", icon: Archive },
      { to: "/ams/collections", label: "Collections", icon: Layers },
      { to: "/ams/trophy-gallery", label: "Trophy Gallery", icon: Landmark },
      { to: "/ams/role-showcase", label: "Role Rooms", icon: Crown },
      { to: "/ams/museum", label: "Museum", icon: Building2 },
    ],
  },
  {
    label: "Progression",
    items: [
      { to: "/ams/xp", label: "XP", icon: Zap },
      { to: "/ams/levels", label: "Levels", icon: ArrowUpCircle },
      { to: "/ams/ranks", label: "Ranks", icon: Crown },
      { to: "/ams/developer-progression", label: "Dev Progression", icon: ArrowUpCircle },
      { to: "/ams/author-progression", label: "Author Progression", icon: ArrowUpCircle },
      { to: "/ams/vendor-progression", label: "Vendor Progression", icon: ArrowUpCircle },
    ],
  },
  {
    label: "Engagement",
    items: [
      { to: "/ams/missions", label: "Missions", icon: Target },
      { to: "/ams/quests", label: "Quests", icon: Flag },
      { to: "/ams/challenges", label: "Challenges", icon: Swords },
    ],
  },
  {
    label: "Rewards",
    items: [
      { to: "/ams/rewards", label: "Rewards", icon: Gift },
      { to: "/ams/claims", label: "Claims", icon: Package },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/ams/leaderboards", label: "Leaderboard", icon: BarChart3 },
      { to: "/ams/analytics", label: "Analytics", icon: LineChart },
    ],
  },
  {
    label: "Vaults",
    items: [
      { to: "/ams/passport-vault", label: "Passport Vault", icon: BookMarked },
      { to: "/ams/achievement-vault", label: "Achievement Vault", icon: Trophy },
      { to: "/ams/award-vault", label: "Award Vault", icon: Award },
      { to: "/ams/badge-vault", label: "Badge Vault", icon: Shield },
      { to: "/ams/trophy-vault", label: "Trophy Vault", icon: Trophy },
      { to: "/ams/trophy-stages", label: "Trophy Stages", icon: Landmark },
      { to: "/ams/certificate-vault", label: "Certificate Vault", icon: Ribbon },
      { to: "/ams/membership-vault", label: "Membership Vault", icon: CreditCard },
      { to: "/ams/rank-vault", label: "Rank Vault", icon: Crown },
      { to: "/ams/verification-vault", label: "Verification Vault", icon: ShieldCheck },
      { to: "/ams/reputation-vault", label: "Reputation Vault", icon: Star },
      { to: "/ams/trust-seal-vault", label: "Trust Seal Vault", icon: Stamp },
      { to: "/ams/recognition-coin-vault", label: "Recognition Coins", icon: Coins },
      { to: "/ams/xp-crystal-vault", label: "XP Crystals", icon: Gem },
      { to: "/ams/reward-chest-vault", label: "Reward Chests", icon: Package },
      { to: "/ams/honor-coin-vault", label: "Honor Coins", icon: Coins },
      { to: "/ams/legacy-medal-vault", label: "Legacy Medals", icon: Medal },
      { to: "/ams/identity-card-vault", label: "Identity Cards", icon: IdCard },
      { to: "/ams/license-card-vault", label: "License Cards", icon: FileBadge },
      { to: "/ams/founder-seal-vault", label: "Founder Seals", icon: Stamp },
      { to: "/ams/hall-of-fame-vault", label: "Hall of Fame Vault", icon: Star },
    ],
  },
];

/** Pinned to the bottom of the sidebar. */
export const bottomNav: NavItem[] = [
  { to: "/ams/chat", label: "Chat", icon: MessageSquare },
  { to: "/ams/ai", label: "AI Center", icon: Sparkles },
  { to: "/ams/notifications", label: "Notifications", icon: Bell },
  { to: "/ams/audit", label: "Audit Logs", icon: ScrollText },
  { to: "/ams/settings", label: "Settings", icon: Settings },
];

const ALL: { item: NavItem; group: string }[] = [
  ...primaryNav.map((item) => ({ item, group: "Command Center" })),
  ...navGroups.flatMap((g) => g.items.map((item) => ({ item, group: g.label }))),
  ...bottomNav.map((item) => ({ item, group: "System" })),
];

/** Longest-prefix match so nested routes still resolve to their module. */
export function navMetaForPath(pathname: string) {
  if (pathname === "/ams" || pathname === "/ams/overview")
    return { label: "Command Center", group: "Overview", icon: LayoutDashboard };
  let best: { item: NavItem; group: string } | null = null;
  for (const entry of ALL) {
    if (entry.item.to === "/ams/overview") continue;
    if (pathname === entry.item.to || pathname.startsWith(entry.item.to + "/")) {
      if (!best || entry.item.to.length > best.item.to.length) best = entry;
    }
  }
  if (!best) return null;
  return { label: best.item.label, group: best.group, icon: best.item.icon };
}
