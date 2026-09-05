/**
 * ProceduralEmblem — deterministic, unique SVG art for every award.
 *
 * Combines: award.id (seed) × type × rarity × department.
 * Two awards never render the same emblem.
 *
 * Layers:
 *   1. Department motif backdrop (circuit / radar / shield / crown …)
 *   2. Type silhouette (trophy cup / badge shield / achievement star …)
 *   3. Rarity halo + particle ring (intensity scales with tier)
 *   4. Seeded geometric ornament (rotation, points, inner pattern)
 */
import { useMemo } from "react";
import {
  DEPARTMENTS, RARITY_META,
  type Award, type AwardType, type Department, type Rarity,
} from "@/lib/ams/types";

/* ---------- seeded RNG ---------- */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let s = seed || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0xffffffff; };
}

/* ---------- department motif ---------- */
function DepartmentMotif({ dept, accent, r }: { dept?: Department; accent: string; r: () => number }) {
  const motif = DEPARTMENTS.find((d) => d.value === dept)?.motif ?? "orbit";
  const op = 0.25;
  switch (motif) {
    case "circuit": {
      const lines = Array.from({ length: 6 }, (_, i) => {
        const y = 20 + i * 16; const x = 10 + r() * 80;
        return <path key={i} d={`M10 ${y} H${x} V${y + 8} H110`} stroke={accent} strokeOpacity={op} strokeWidth="0.8" fill="none" />;
      });
      return <g>{lines}<circle cx="60" cy="60" r="40" stroke={accent} strokeOpacity={op} strokeWidth="0.6" fill="none" /></g>;
    }
    case "radar": {
      return <g>
        {[18, 32, 46].map((rad) => <circle key={rad} cx="60" cy="60" r={rad} stroke={accent} strokeOpacity={op} strokeWidth="0.6" fill="none" />)}
        <line x1="60" y1="20" x2="60" y2="100" stroke={accent} strokeOpacity={op} strokeWidth="0.6" />
        <line x1="20" y1="60" x2="100" y2="60" stroke={accent} strokeOpacity={op} strokeWidth="0.6" />
      </g>;
    }
    case "shield":
      return <path d="M60 22 L92 34 V62 Q92 88 60 100 Q28 88 28 62 V34 Z" stroke={accent} strokeOpacity={op} strokeWidth="0.8" fill={`${accent}10`} />;
    case "crown":
      return <path d="M30 70 L40 40 L50 60 L60 32 L70 60 L80 40 L90 70 Z" stroke={accent} strokeOpacity={op} strokeWidth="0.8" fill={`${accent}12`} />;
    case "diamond":
      return <path d="M60 22 L94 60 L60 98 L26 60 Z" stroke={accent} strokeOpacity={op} strokeWidth="0.8" fill={`${accent}10`} />;
    case "wave":
      return <g>{[40, 56, 72].map((y) => <path key={y} d={`M10 ${y} Q35 ${y - 8} 60 ${y} T110 ${y}`} stroke={accent} strokeOpacity={op} strokeWidth="0.7" fill="none" />)}</g>;
    case "prism":
      return <g><polygon points="60,24 96,84 24,84" stroke={accent} strokeOpacity={op} fill={`${accent}10`} /><line x1="60" y1="24" x2="60" y2="84" stroke={accent} strokeOpacity={op} /></g>;
    case "lock":
      return <g><rect x="40" y="54" width="40" height="38" rx="4" stroke={accent} strokeOpacity={op} fill={`${accent}10`} /><path d="M48 54 V42 a12 12 0 0124 0 V54" stroke={accent} strokeOpacity={op} fill="none" /></g>;
    case "gear": {
      const teeth = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2; const x1 = 60 + Math.cos(a) * 36; const y1 = 60 + Math.sin(a) * 36;
        const x2 = 60 + Math.cos(a) * 44; const y2 = 60 + Math.sin(a) * 44;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeOpacity={op} strokeWidth="2" />;
      });
      return <g><circle cx="60" cy="60" r="34" stroke={accent} strokeOpacity={op} fill="none" />{teeth}</g>;
    }
    case "orbit":
    default:
      return <g>
        <ellipse cx="60" cy="60" rx="44" ry="18" stroke={accent} strokeOpacity={op} fill="none" transform="rotate(30 60 60)" />
        <ellipse cx="60" cy="60" rx="44" ry="18" stroke={accent} strokeOpacity={op} fill="none" transform="rotate(-30 60 60)" />
      </g>;
  }
}

/* ---------- type silhouette ---------- */
function TypeShape({ type, color }: { type: AwardType; color: string }) {
  const g = `url(#grad-${type})`;
  switch (type) {
    case "trophy":
      return <g filter="url(#soft)">
        <path d="M44 44 V36 H76 V44 Q76 64 60 70 Q44 64 44 44 Z" fill={g} stroke={color} strokeWidth="0.8" />
        <rect x="54" y="70" width="12" height="10" fill={color} />
        <rect x="46" y="80" width="28" height="4" rx="1" fill={color} />
        <path d="M44 40 Q34 40 34 50 Q34 58 44 60" stroke={color} fill="none" strokeWidth="1.2" />
        <path d="M76 40 Q86 40 86 50 Q86 58 76 60" stroke={color} fill="none" strokeWidth="1.2" />
      </g>;
    case "badge":
      return <g filter="url(#soft)">
        <polygon points="60,32 80,44 80,68 60,84 40,68 40,44" fill={g} stroke={color} strokeWidth="0.8" />
        <circle cx="60" cy="58" r="9" fill={color} fillOpacity="0.25" stroke={color} />
      </g>;
    case "rank":
      return <g filter="url(#soft)">
        <path d="M36 72 L60 36 L84 72 L72 80 L60 70 L48 80 Z" fill={g} stroke={color} strokeWidth="0.8" />
      </g>;
    case "milestone":
      return <g filter="url(#soft)">
        <rect x="42" y="40" width="36" height="40" rx="4" fill={g} stroke={color} strokeWidth="0.8" />
        <line x1="42" y1="52" x2="78" y2="52" stroke={color} strokeOpacity="0.4" />
        <line x1="42" y1="64" x2="78" y2="64" stroke={color} strokeOpacity="0.4" />
      </g>;
    case "streak":
      return <g filter="url(#soft)">
        <path d="M60 32 Q72 50 68 60 Q78 56 76 70 Q72 82 60 84 Q48 82 44 70 Q42 56 52 60 Q48 50 60 32 Z" fill={g} stroke={color} strokeWidth="0.8" />
      </g>;
    case "achievement":
    default:
      return <g filter="url(#soft)">
        <polygon points="60,32 67,52 88,52 71,64 78,84 60,72 42,84 49,64 32,52 53,52" fill={g} stroke={color} strokeWidth="0.8" />
      </g>;
  }
}

/* ---------- ornament: seeded petals around the core ---------- */
function Ornament({ seed, color, intensity }: { seed: number; color: string; intensity: number }) {
  const r = rng(seed);
  const count = 6 + Math.floor(r() * 6) + intensity * 2; // 6–12 + tier bonus
  const offset = r() * 360;
  const radius = 50 + r() * 4;
  const petals = Array.from({ length: count }, (_, i) => {
    const a = offset + (i / count) * 360;
    const len = 4 + r() * 6 + intensity * 0.8;
    return (
      <line
        key={i}
        x1="60" y1="60"
        x2={60 + Math.cos((a * Math.PI) / 180) * radius}
        y2={60 + Math.sin((a * Math.PI) / 180) * radius}
        stroke={color} strokeOpacity={0.4 + intensity * 0.05} strokeWidth={0.6}
        transform={`translate(${Math.cos((a * Math.PI) / 180) * -len * 0.0} 0)`}
      />
    );
  });
  return <g>{petals}</g>;
}

/* ---------- public component ---------- */
export interface ProceduralEmblemProps {
  award: Pick<Award, "id" | "type" | "rarity" | "department" | "media">;
  size?: number;
  className?: string;
}

export function ProceduralEmblem({ award, size = 160, className }: ProceduralEmblemProps) {
  const rarity: Rarity = award.rarity;
  const meta = RARITY_META[rarity];
  const deptMeta = DEPARTMENTS.find((d) => d.value === award.department);
  const accent = award.media.themeColor ?? deptMeta?.accent ?? meta.hue;

  const seed = useMemo(() => hash(`${award.id}:${award.type}:${rarity}:${award.department ?? "none"}`), [award.id, award.type, rarity, award.department]);
  const r = useMemo(() => rng(seed), [seed]);
  const rotation = Math.floor(r() * 360);
  const uid = useMemo(() => `e${seed.toString(36)}`, [seed]);

  const intensity = Math.min(8, meta.tier);

  return (
    <svg
      viewBox="0 0 120 120"
      width={size} height={size}
      className={className}
      aria-label={`${rarity} ${award.type} emblem`}
    >
      <defs>
        <radialGradient id={`bg-${uid}`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={meta.hue} stopOpacity="0.45" />
          <stop offset="60%" stopColor={accent} stopOpacity="0.12" />
          <stop offset="100%" stopColor="#0a1220" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`grad-trophy`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={meta.hue} /><stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id={`grad-badge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} /><stop offset="100%" stopColor={meta.hue} />
        </linearGradient>
        <linearGradient id={`grad-rank`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={accent} /><stop offset="100%" stopColor={meta.hue} />
        </linearGradient>
        <linearGradient id={`grad-milestone`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={meta.hue} /><stop offset="100%" stopColor={accent} />
        </linearGradient>
        <linearGradient id={`grad-streak`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" /><stop offset="100%" stopColor={meta.hue} />
        </linearGradient>
        <linearGradient id={`grad-achievement`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={meta.hue} /><stop offset="100%" stopColor={accent} />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="b" />
          <feOffset in="b" dx="0" dy="1.2" result="o" />
          <feMerge><feMergeNode in="o" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* halo */}
      <circle cx="60" cy="60" r="58" fill={`url(#bg-${uid})`} />
      {meta.tier >= 5 && (
        <circle cx="60" cy="60" r="54" fill="none" stroke={meta.hue} strokeOpacity="0.45" strokeWidth="0.6" strokeDasharray={`${2 + meta.tier} ${4}`} />
      )}
      {meta.tier >= 8 && (
        <circle cx="60" cy="60" r="48" fill="none" stroke={accent} strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="1 3">
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur={`${24 - meta.tier}s`} repeatCount="indefinite" />
        </circle>
      )}

      {/* department motif (rotated by seed) */}
      <g transform={`rotate(${rotation} 60 60)`} opacity="0.9">
        <DepartmentMotif dept={award.department} accent={accent} r={r} />
      </g>

      {/* ornament */}
      <Ornament seed={seed} color={accent} intensity={intensity} />

      {/* core silhouette */}
      <TypeShape type={award.type} color={meta.hue} />

      {/* tier markers */}
      {Array.from({ length: Math.min(meta.tier, 10) }, (_, i) => {
        const a = -90 + (i / 10) * 360;
        const x = 60 + Math.cos((a * Math.PI) / 180) * 56;
        const y = 60 + Math.sin((a * Math.PI) / 180) * 56;
        return <circle key={i} cx={x} cy={y} r="1.4" fill={meta.hue} />;
      })}
    </svg>
  );
}
