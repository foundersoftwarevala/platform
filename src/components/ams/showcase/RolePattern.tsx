// Per-role decorative SVG patterns. Each renders a completely different
// motif — never a generic dot grid. Used as background layers on covers,
// passport pages, and certificates.

import type { PatternKind } from "@/lib/ams/role-themes";

export function RolePattern({
  kind, color, opacity = 0.18, id, className,
}: { kind: PatternKind; color: string; opacity?: number; id: string; className?: string }) {
  const pid = `pat-${id}`;
  const c = color;

  const patterns: Record<PatternKind, React.ReactNode> = {
    circuit: (
      <pattern id={pid} width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M0 30 H20 V10 H40 V50 H60" stroke={c} strokeWidth="0.7" fill="none" />
        <circle cx="20" cy="10" r="1.6" fill={c} />
        <circle cx="40" cy="50" r="1.6" fill={c} />
        <rect x="28" y="26" width="8" height="8" fill="none" stroke={c} strokeWidth="0.7" />
      </pattern>
    ),
    "diamond-grid": (
      <pattern id={pid} width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M20 0 L40 20 L20 40 L0 20 Z" stroke={c} strokeWidth="0.6" fill="none" />
        <circle cx="20" cy="20" r="1.2" fill={c} />
      </pattern>
    ),
    "royal-crest": (
      <pattern id={pid} width="70" height="70" patternUnits="userSpaceOnUse">
        <path d="M35 8 L48 20 L48 40 L35 52 L22 40 L22 20 Z" fill="none" stroke={c} strokeWidth="0.7" />
        <path d="M35 20 L42 28 L35 40 L28 28 Z" fill={c} opacity="0.5" />
      </pattern>
    ),
    "quill-lines": (
      <pattern id={pid} width="50" height="50" patternUnits="userSpaceOnUse">
        <path d="M6 44 Q 20 20 44 6" stroke={c} strokeWidth="0.6" fill="none" />
        <path d="M14 46 Q 26 30 46 18" stroke={c} strokeWidth="0.4" fill="none" opacity="0.7" />
      </pattern>
    ),
    "storefront-tiles": (
      <pattern id={pid} width="40" height="24" patternUnits="userSpaceOnUse">
        <rect x="1" y="1" width="18" height="10" fill="none" stroke={c} strokeWidth="0.6" />
        <rect x="21" y="1" width="18" height="10" fill="none" stroke={c} strokeWidth="0.6" />
        <rect x="11" y="13" width="18" height="10" fill="none" stroke={c} strokeWidth="0.6" />
      </pattern>
    ),
    "network-nodes": (
      <pattern id={pid} width="80" height="80" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="2" fill={c} />
        <circle cx="70" cy="20" r="2" fill={c} />
        <circle cx="30" cy="60" r="2" fill={c} />
        <circle cx="55" cy="70" r="2" fill={c} />
        <path d="M10 10 L70 20 L55 70 L30 60 Z" fill="none" stroke={c} strokeWidth="0.5" />
      </pattern>
    ),
    "sound-waves": (
      <pattern id={pid} width="60" height="30" patternUnits="userSpaceOnUse">
        <path d="M0 15 Q 15 0 30 15 T 60 15" stroke={c} strokeWidth="0.7" fill="none" />
        <path d="M0 15 Q 15 30 30 15 T 60 15" stroke={c} strokeWidth="0.4" fill="none" opacity="0.6" />
      </pattern>
    ),
    "brush-strokes": (
      <pattern id={pid} width="70" height="70" patternUnits="userSpaceOnUse">
        <path d="M4 20 Q 30 4 60 26" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
        <path d="M6 50 Q 34 40 64 58" stroke={c} strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.5" />
      </pattern>
    ),
    "search-orbit": (
      <pattern id={pid} width="70" height="70" patternUnits="userSpaceOnUse">
        <circle cx="35" cy="35" r="16" fill="none" stroke={c} strokeWidth="0.6" />
        <circle cx="35" cy="35" r="26" fill="none" stroke={c} strokeWidth="0.4" opacity="0.7" />
        <circle cx="35" cy="35" r="2" fill={c} />
        <path d="M46 46 L58 58" stroke={c} strokeWidth="1" />
      </pattern>
    ),
    "halo-rings": (
      <pattern id={pid} width="60" height="60" patternUnits="userSpaceOnUse">
        <circle cx="30" cy="30" r="10" fill="none" stroke={c} strokeWidth="0.7" />
        <circle cx="30" cy="30" r="18" fill="none" stroke={c} strokeWidth="0.4" opacity="0.7" />
        <circle cx="30" cy="30" r="26" fill="none" stroke={c} strokeWidth="0.3" opacity="0.5" />
      </pattern>
    ),
    stardust: (
      <pattern id={pid} width="60" height="60" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="18" r="0.9" fill={c} />
        <circle cx="42" cy="8" r="0.6" fill={c} opacity="0.8" />
        <circle cx="30" cy="34" r="1.2" fill={c} />
        <circle cx="52" cy="46" r="0.7" fill={c} opacity="0.7" />
        <circle cx="16" cy="50" r="0.5" fill={c} opacity="0.6" />
      </pattern>
    ),
  };

  return (
    <svg className={className} style={{ opacity }} preserveAspectRatio="none">
      <defs>{patterns[kind]}</defs>
      <rect width="100%" height="100%" fill={`url(#${pid})`} />
    </svg>
  );
}
