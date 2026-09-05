// Procedural insignias — every badge / trophy / medal is unique per
// (role × module × grade). No two outputs share shape, material, ornament.
// Pure SVG, zero assets, deterministic by name.

import {
  Code2, PenTool, TrendingUp, Megaphone, Radio, Headphones, Lock, BookOpen,
  Store, Network, Users, Crown, Star, Shield, Trophy, Award, Medal,
  Sparkles, Diamond, Cpu, Gem, Target, Flame, Zap,
} from "lucide-react";

export type Grade =
  | "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond"
  | "Elite" | "Champion" | "Legend" | "Founder" | "Ultimate"
  | "Mythic" | "Legendary" | "Epic" | "Rare" | "Common";

export type Role =
  | "developer" | "designer" | "sales" | "marketing" | "influencer"
  | "support" | "security" | "author" | "vendor" | "reseller"
  | "community" | "management";

export type Module =
  | "identity" | "recognition" | "progress" | "community"
  | "collections" | "analytics";

// ── deterministic 32-bit hash ──
function hash(s: string) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── grade material palettes (Bronze → Ultimate) ──
const GRADES: Record<Grade, { a: string; b: string; rim: string; glow: string; tier: number }> = {
  Common:    { a: "#9aa3ad", b: "#5a626b", rim: "#3d434a", glow: "#9aa3ad", tier: 0 },
  Bronze:    { a: "#e3a76b", b: "#8a5429", rim: "#5a3618", glow: "#e3a76b", tier: 1 },
  Rare:      { a: "#7cc3ff", b: "#2563eb", rim: "#1e3a8a", glow: "#7cc3ff", tier: 1 },
  Silver:    { a: "#f0f1f3", b: "#9aa1ab", rim: "#6b7280", glow: "#e8eaee", tier: 2 },
  Epic:      { a: "#d8b4fe", b: "#7c3aed", rim: "#4c1d95", glow: "#c084fc", tier: 2 },
  Gold:      { a: "#fde488", b: "#c98a17", rim: "#7a4e08", glow: "#f5d77a", tier: 3 },
  Platinum:  { a: "#eef2f7", b: "#a8b3c4", rim: "#5e6878", glow: "#dfe6f0", tier: 4 },
  Diamond:   { a: "#d4f3ff", b: "#5ec0e8", rim: "#1e4a66", glow: "#9be5ff", tier: 5 },
  Legendary: { a: "#ffb98a", b: "#d4452a", rim: "#7a2010", glow: "#ff9b6a", tier: 6 },
  Elite:     { a: "#ffe9a8", b: "#d4a14a", rim: "#7a5418", glow: "#f5d77a", tier: 6 },
  Champion:  { a: "#ffd1a8", b: "#ff7a3d", rim: "#7a2a08", glow: "#ff9b6a", tier: 7 },
  Mythic:    { a: "#ecc1ff", b: "#a04dff", rim: "#3b0a6b", glow: "#d97aff", tier: 8 },
  Legend:    { a: "#f3c7ff", b: "#7a1fd1", rim: "#2c0858", glow: "#d97aff", tier: 8 },
  Founder:   { a: "#fff4c6", b: "#e0aa2b", rim: "#5c3a05", glow: "#ffe28a", tier: 9 },
  Ultimate:  { a: "#fffbeb", b: "#f0c14b", rim: "#3a2604", glow: "#fff1a8", tier: 10 },
};

// ── role inference from arbitrary text (badge / achievement title) ──
const ROLE_RULES: Array<[RegExp, Role]> = [
  [/code|review|engineer|architect|devops|api|build|bug|beta|open[\s-]?source/i, "developer"],
  [/design|ui|ux|figma|brand asset/i, "designer"],
  [/sale|deal|revenue|quota|pipeline/i, "sales"],
  [/market|seo|campaign|brand/i, "marketing"],
  [/influenc|creator|stream|follow|live|voice|speaker/i, "influencer"],
  [/support|customer|help|onboard/i, "support"],
  [/secur|encrypt|2fa|verified identity|trust/i, "security"],
  [/author|article|publish|book|paper/i, "author"],
  [/vendor|merchant|store|marketplace|product approved/i, "vendor"],
  [/resell|distrib|partner network/i, "reseller"],
  [/mentor|communit|kudos|hall|founder|recognition|squad/i, "community"],
  [/champion|leader|exec|crown|presiden|director/i, "management"],
];

export function inferRole(text: string): Role {
  for (const [re, r] of ROLE_RULES) if (re.test(text)) return r;
  return "community";
}

const ROLE_ICON: Record<Role, typeof Code2> = {
  developer: Code2, designer: PenTool, sales: TrendingUp, marketing: Megaphone,
  influencer: Radio, support: Headphones, security: Lock, author: BookOpen,
  vendor: Store, reseller: Network, community: Users, management: Crown,
};

const MODULE_ICON: Record<Module, typeof Star> = {
  identity: Shield, recognition: Award, progress: Zap,
  community: Users, collections: Gem, analytics: Target,
};

// ── shape system — different per (role, gradeTier % shapes) ──
type ShapeKey = "shield" | "hex" | "star8" | "rosette" | "octagon" | "lozenge" | "laurel" | "crown" | "diamond";
const SHAPE_BY_ROLE: Record<Role, ShapeKey[]> = {
  developer:  ["hex", "octagon", "shield"],
  designer:   ["rosette", "lozenge", "hex"],
  sales:      ["star8", "shield", "crown"],
  marketing:  ["rosette", "star8", "hex"],
  influencer: ["star8", "rosette", "diamond"],
  support:    ["shield", "hex", "octagon"],
  security:   ["shield", "octagon", "lozenge"],
  author:     ["lozenge", "rosette", "laurel"],
  vendor:     ["octagon", "shield", "crown"],
  reseller:   ["hex", "octagon", "star8"],
  community:  ["laurel", "rosette", "shield"],
  management: ["crown", "diamond", "star8"],
};

function shapePath(kind: ShapeKey): string {
  // All shapes drawn inside 0..100 viewBox.
  switch (kind) {
    case "shield":
      return "M50 6 L88 18 L88 52 C88 76 70 90 50 96 C30 90 12 76 12 52 L12 18 Z";
    case "hex":
      return "M50 6 L88 28 L88 72 L50 94 L12 72 L12 28 Z";
    case "octagon":
      return "M30 6 L70 6 L94 30 L94 70 L70 94 L30 94 L6 70 L6 30 Z";
    case "lozenge":
      return "M50 4 L92 50 L50 96 L8 50 Z";
    case "diamond":
      return "M50 8 L84 36 L72 92 L28 92 L16 36 Z";
    case "star8": {
      const pts: string[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8 - Math.PI / 2;
        const r = i % 2 === 0 ? 46 : 22;
        pts.push(`${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`);
      }
      return "M" + pts.join(" L") + " Z";
    }
    case "rosette": {
      const pts: string[] = [];
      for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12 - Math.PI / 2;
        const r = i % 2 === 0 ? 46 : 38;
        pts.push(`${50 + r * Math.cos(a)} ${50 + r * Math.sin(a)}`);
      }
      return "M" + pts.join(" L") + " Z";
    }
    case "crown":
      return "M10 70 L18 28 L34 50 L50 18 L66 50 L82 28 L90 70 L90 88 L10 88 Z";
    case "laurel":
      return "M50 8 C72 18 86 36 86 56 C86 78 70 92 50 94 C30 92 14 78 14 56 C14 36 28 18 50 8 Z";
  }
}

// ── kind: badge | trophy | medal | certificate ──
export type InsigniaKind = "badge" | "trophy" | "medal";

export interface InsigniaProps {
  name: string;          // used to seed shape variation
  grade: Grade;
  role?: Role;           // inferred from name if omitted
  module?: Module;
  kind?: InsigniaKind;
  size?: number;
  unlocked?: boolean;
  className?: string;
}

export function Insignia({
  name, grade, role, module: mod, kind = "badge",
  size = 80, unlocked = true, className = "",
}: InsigniaProps) {
  const g = GRADES[grade] ?? GRADES.Gold;
  const r = role ?? inferRole(name);
  const seed = hash(`${name}|${r}|${grade}|${kind}`);
  const shapes = SHAPE_BY_ROLE[r];
  const shape = shapes[seed % shapes.length];
  const path = shapePath(shape);
  const RoleIcon = ROLE_ICON[r];
  const ModIcon = mod ? MODULE_ICON[mod] : Sparkles;

  // unique ornament rotation / pip count per item
  const rot = (seed >> 3) % 30 - 15;
  const pipCount = 4 + ((seed >> 5) % 4); // 4–7 pips
  const engrave = (seed >> 11) % 5;       // 0–4 engraving variants

  // grade-driven flourishes
  const showLaurel = g.tier >= 6;
  const showCrown = g.tier >= 8;
  const showStarHalo = g.tier >= 4;
  const showRibbon = kind !== "badge" || g.tier >= 5;

  const uid = `ins-${seed.toString(36)}`;

  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={size * (140 / 120)}
      className={`${className} ${unlocked ? "" : "opacity-40 grayscale"}`}
      aria-label={`${name} · ${grade}`}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={g.a} />
          <stop offset="50%" stopColor={g.b} />
          <stop offset="100%" stopColor={g.rim} />
        </linearGradient>
        <radialGradient id={`${uid}-shine`} cx="35%" cy="25%" r="60%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="40%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.35" />
        </radialGradient>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id={`${uid}-ribbon`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={g.b} />
          <stop offset="100%" stopColor={g.rim} />
        </linearGradient>
      </defs>

      {/* ribbon tails (trophy/medal/higher grades) */}
      {showRibbon && (
        <g transform="translate(60 92)">
          <polygon points="-18,0 -6,0 -14,46 -22,40" fill={`url(#${uid}-ribbon)`} opacity="0.95" />
          <polygon points="18,0 6,0 14,46 22,40" fill={`url(#${uid}-ribbon)`} opacity="0.95" />
        </g>
      )}

      {/* trophy base (only for trophy kind) */}
      {kind === "trophy" && (
        <g>
          <rect x="34" y="118" width="52" height="10" rx="2" fill={g.rim} />
          <rect x="40" y="108" width="40" height="10" rx="2" fill={`url(#${uid}-ribbon)`} />
          <rect x="48" y="98"  width="24" height="12" rx="2" fill={g.rim} />
        </g>
      )}

      {/* medal chain (medal kind) */}
      {kind === "medal" && (
        <path d="M20 6 Q60 -6 100 6 L78 36 Q60 30 42 36 Z" fill="none" stroke={g.rim} strokeWidth="3" />
      )}

      {/* outer halo */}
      {showStarHalo && (
        <g transform="translate(10 14)" opacity="0.55">
          {Array.from({ length: pipCount * 2 }).map((_, i) => {
            const a = (i * Math.PI) / pipCount;
            const x = 50 + 52 * Math.cos(a);
            const y = 50 + 52 * Math.sin(a);
            return <circle key={i} cx={x} cy={y} r="1.4" fill={g.glow} />;
          })}
        </g>
      )}

      {/* body */}
      <g transform={`translate(10 14) rotate(${rot} 50 50)`} filter={`url(#${uid}-glow)`}>
        <path d={path} fill={`url(#${uid}-body)`} stroke={g.rim} strokeWidth="2.4" />
        <path d={path} fill={`url(#${uid}-shine)`} />
        {/* engraving rings */}
        {engrave > 0 && <path d={path} fill="none" stroke={g.a} strokeOpacity="0.45" strokeWidth="0.8" transform="translate(50 50) scale(0.78) translate(-50 -50)" />}
        {engrave > 2 && <path d={path} fill="none" stroke={g.rim} strokeOpacity="0.6" strokeWidth="0.6" transform="translate(50 50) scale(0.62) translate(-50 -50)" />}
      </g>

      {/* laurel wreath */}
      {showLaurel && (
        <g opacity="0.85" stroke={g.rim} strokeWidth="1.6" fill="none">
          <path d="M14 78 Q4 56 18 32" />
          <path d="M106 78 Q116 56 102 32" />
          {Array.from({ length: 5 }).map((_, i) => (
            <g key={i}>
              <ellipse cx={10 + i * 2} cy={70 - i * 10} rx="3.5" ry="1.6" fill={g.b} transform={`rotate(${-30 - i * 8} ${10 + i * 2} ${70 - i * 10})`} />
              <ellipse cx={110 - i * 2} cy={70 - i * 10} rx="3.5" ry="1.6" fill={g.b} transform={`rotate(${30 + i * 8} ${110 - i * 2} ${70 - i * 10})`} />
            </g>
          ))}
        </g>
      )}

      {/* crown */}
      {showCrown && (
        <g transform="translate(40 4)" fill={g.a} stroke={g.rim} strokeWidth="1.2">
          <path d="M0 16 L6 4 L14 14 L20 0 L26 14 L34 4 L40 16 L40 22 L0 22 Z" />
          <circle cx="20" cy="4" r="2" fill={g.glow} />
        </g>
      )}

      {/* center role icon */}
      <foreignObject x="42" y="46" width="36" height="36">
        <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
          <RoleIcon size={22} color={g.rim} strokeWidth={2.5} />
        </div>
      </foreignObject>

      {/* module pip (top) */}
      {mod && (
        <foreignObject x="52" y="20" width="16" height="16">
          <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
            <ModIcon size={10} color={g.rim} strokeWidth={3} />
          </div>
        </foreignObject>
      )}

      {/* grade tier pips (bottom) */}
      <g transform="translate(60 124)">
        {Array.from({ length: Math.min(g.tier, 10) }).map((_, i) => {
          const x = (i - (Math.min(g.tier, 10) - 1) / 2) * 7;
          return <circle key={i} cx={x} cy={0} r="2.2" fill={g.glow} stroke={g.rim} strokeWidth="0.6" />;
        })}
      </g>
    </svg>
  );
}

// Helper: pick module from a screen / context
export const MODULE_FROM_LABEL: Record<string, Module> = {
  Passport: "identity", Membership: "identity", "Identity Card": "identity",
  "Public Profile": "identity", "QR Identity": "identity", Verification: "identity",
  Achievements: "recognition", Badges: "recognition", Trophies: "recognition",
  Recognition: "recognition", Certificates: "recognition",
  "Levels & XP": "progress", Ranks: "progress", Missions: "progress",
  Journey: "progress", Reputation: "progress",
  Chat: "community", Leaderboard: "community", "Hall Of Fame": "community",
  Rewards: "community", "Community Ranking": "community",
  Collections: "collections",
  "XP Analytics": "analytics", "Achievement Analytics": "analytics",
  "Engagement Analytics": "analytics", "Growth Analytics": "analytics",
};
