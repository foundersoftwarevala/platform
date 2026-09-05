// Award Management Center — domain types.

export type AwardCategory =
  | "marketplace" | "customer" | "developer" | "support" | "sales"
  | "reseller" | "franchise" | "affiliate" | "influencer" | "author"
  | "vendor" | "boss" | "employee" | "company" | "global";

export const AWARD_CATEGORIES: { value: AwardCategory; label: string }[] = [
  { value: "marketplace", label: "Marketplace" },
  { value: "customer", label: "Customer" },
  { value: "developer", label: "Developer" },
  { value: "support", label: "Support" },
  { value: "sales", label: "Sales" },
  { value: "reseller", label: "Reseller" },
  { value: "franchise", label: "Franchise" },
  { value: "affiliate", label: "Affiliate" },
  { value: "influencer", label: "Influencer" },
  { value: "author", label: "Author" },
  { value: "vendor", label: "Vendor" },
  { value: "boss", label: "Boss" },
  { value: "employee", label: "Employee" },
  { value: "company", label: "Company" },
  { value: "global", label: "Global" },
];

/* ============================================================
 * RARITY — 10 tiers, each with its own glow, border, animation.
 * ============================================================ */
export type Rarity =
  | "common" | "uncommon" | "rare" | "epic" | "legendary"
  | "mythic" | "immortal" | "founder" | "galaxy" | "universal";

export const RARITIES: Rarity[] = [
  "common", "uncommon", "rare", "epic", "legendary",
  "mythic", "immortal", "founder", "galaxy", "universal",
];

export const RARITY_META: Record<Rarity, { label: string; tier: number; hue: string; glow: string }> = {
  common:    { label: "Common",    tier: 1,  hue: "#9aa3b2", glow: "rgba(154,163,178,0.35)" },
  uncommon:  { label: "Uncommon",  tier: 2,  hue: "#5eead4", glow: "rgba(94,234,212,0.45)" },
  rare:      { label: "Rare",      tier: 3,  hue: "#60a5fa", glow: "rgba(96,165,250,0.55)" },
  epic:      { label: "Epic",      tier: 4,  hue: "#c084fc", glow: "rgba(192,132,252,0.55)" },
  legendary: { label: "Legendary", tier: 5,  hue: "#facc15", glow: "rgba(250,204,21,0.6)"  },
  mythic:    { label: "Mythic",    tier: 6,  hue: "#fb7185", glow: "rgba(251,113,133,0.65)" },
  immortal:  { label: "Immortal",  tier: 7,  hue: "#f97316", glow: "rgba(249,115,22,0.7)"  },
  founder:   { label: "Founder",   tier: 8,  hue: "#e8d29a", glow: "rgba(232,210,154,0.75)" },
  galaxy:    { label: "Galaxy",    tier: 9,  hue: "#a78bfa", glow: "rgba(167,139,250,0.8)" },
  universal: { label: "Universal", tier: 10, hue: "#22d3ee", glow: "rgba(34,211,238,0.85)" },
};

/* ============================================================
 * DEPARTMENT — visual language per discipline.
 * ============================================================ */
export type Department =
  | "developer" | "seo" | "marketing" | "sales" | "support"
  | "designer" | "security" | "founder" | "operations" | "community";

export const DEPARTMENTS: { value: Department; label: string; accent: string; motif: string }[] = [
  { value: "developer",  label: "Developer",  accent: "#22d3ee", motif: "circuit" },
  { value: "seo",        label: "SEO",        accent: "#34d399", motif: "radar"   },
  { value: "marketing",  label: "Marketing",  accent: "#f472b6", motif: "wave"    },
  { value: "sales",      label: "Sales",      accent: "#fbbf24", motif: "diamond" },
  { value: "support",    label: "Support",    accent: "#60a5fa", motif: "shield"  },
  { value: "designer",   label: "Designer",   accent: "#c084fc", motif: "prism"   },
  { value: "security",   label: "Security",   accent: "#ef4444", motif: "lock"    },
  { value: "founder",    label: "Founder",    accent: "#e8d29a", motif: "crown"   },
  { value: "operations", label: "Operations", accent: "#94a3b8", motif: "gear"    },
  { value: "community",  label: "Community",  accent: "#fb923c", motif: "orbit"   },
];

export type AwardStatus =
  | "draft" | "pending" | "approved" | "rejected"
  | "published" | "unpublished" | "archived" | "disabled";

export type AwardVisibility = "public" | "private" | "role-restricted" | "module-restricted";

export type AwardType = "trophy" | "badge" | "achievement" | "rank" | "milestone" | "streak";

export interface AwardMedia {
  model3dUrl?: string;
  animatedIconUrl?: string;
  lottieUrl?: string;
  gifUrl?: string;
  soundUrl?: string;
  themeColor?: string;
}

export interface UnlockCondition {
  id: string;
  metric: string;
  operator: ">=" | ">" | "=" | "<" | "<=";
  value: number | string;
}

export interface EligibilityRule {
  id: string;
  type: "role" | "module" | "country" | "tier" | "custom";
  value: string;
}

export interface AwardRewards {
  xp: number;
  coins: number;
  rankImpact: number;
  levelImpact: number;
  monetaryValue: number;
  currency?: string;
}

export interface AwardVersion {
  version: number;
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface AwardAuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  meta?: Record<string, unknown>;
}

export interface Award {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: AwardType;
  category: AwardCategory;
  rarity: Rarity;
  department?: Department;
  priority: number;
  status: AwardStatus;
  visibility: AwardVisibility;
  media: AwardMedia;
  unlockConditions: UnlockCondition[];
  eligibilityRules: EligibilityRule[];
  supportedModules: string[];
  supportedRoles: string[];
  rewards: AwardRewards;
  unlockAnimation?: string;
  celebrationAnimation?: string;
  versions: AwardVersion[];
  audit: AwardAuditEntry[];
  usage: { earnedCount: number; lastEarnedAt?: string };
  createdAt: string;
  updatedAt: string;
}

export interface AwardFilters {
  search?: string;
  category?: AwardCategory;
  type?: AwardType;
  rarity?: Rarity;
  department?: Department;
  status?: AwardStatus;
  visibility?: AwardVisibility;
  module?: string;
  role?: string;
  minLevel?: number;
  minXp?: number;
  from?: string;
  to?: string;
}

export interface PageResult<T> {
  rows: T[];
  total: number;
}
