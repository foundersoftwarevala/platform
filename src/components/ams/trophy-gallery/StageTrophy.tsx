// Handcrafted SVG trophy silhouettes — one shape per stage. Each accepts a
// gradient palette so materials read as copper, bronze, silver, gold, etc.

import type { DeveloperStage } from "@/lib/ams/developer-stages";

type Props = { shape: DeveloperStage["trophyShape"]; accent: string; id: string; className?: string };

export function StageTrophy({ shape, accent, id, className }: Props) {
  const gradId = `sg-${id}`;
  const shineId = `sh-${id}`;
  const commonDefs = (
    <defs>
      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
        <stop offset="35%" stopColor={accent} />
        <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
      </linearGradient>
      <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="50%" stopColor="#ffffff" stopOpacity="0.55" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id={`${gradId}-glow`} cx="50%" cy="40%" r="50%">
        <stop offset="0%" stopColor={accent} stopOpacity="0.6" />
        <stop offset="100%" stopColor={accent} stopOpacity="0" />
      </radialGradient>
    </defs>
  );

  const base = (
    <g>
      <rect x="45" y="215" width="110" height="14" rx="3" fill={`url(#${gradId})`} />
      <rect x="60" y="200" width="80" height="14" rx="2" fill={`url(#${gradId})`} opacity="0.85" />
      <rect x="70" y="192" width="60" height="8" rx="1" fill="#000" opacity="0.55" />
    </g>
  );

  const halo = <circle cx="100" cy="90" r="80" fill={`url(#${gradId}-glow)`} />;

  const shine = (
    <rect x="0" y="0" width="200" height="240" fill={`url(#${shineId})`}
      style={{ mixBlendMode: "screen" }} className="trophy-shine" />
  );

  let body: React.ReactNode = null;
  switch (shape) {
    case "cup":
      body = <>
        <path d="M60 40 h80 v40 a40 40 0 0 1 -80 0 z" fill={`url(#${gradId})`} />
        <path d="M60 60 h-16 v18 a10 10 0 0 0 16 10 z" fill={`url(#${gradId})`} />
        <path d="M140 60 h16 v18 a10 10 0 0 1 -16 10 z" fill={`url(#${gradId})`} />
        <rect x="88" y="120" width="24" height="70" rx="4" fill={`url(#${gradId})`} />
      </>; break;
    case "flame":
      body = <>
        <path d="M100 20 C 70 60, 60 90, 80 130 C 90 110, 100 105, 100 90 C 110 110, 130 120, 120 140 C 115 155, 100 165, 100 190 C 130 175, 150 145, 145 110 C 135 80, 120 55, 100 20 Z" fill={`url(#${gradId})`} />
        <rect x="88" y="170" width="24" height="30" rx="3" fill={`url(#${gradId})`} />
      </>; break;
    case "obelisk":
      body = <>
        <path d="M85 30 L115 30 L125 190 L75 190 Z" fill={`url(#${gradId})`} />
        <path d="M85 30 L115 30 L110 60 L90 60 Z" fill="#fff" opacity="0.25" />
      </>; break;
    case "diamond":
      body = <>
        <path d="M100 20 L150 80 L100 170 L50 80 Z" fill={`url(#${gradId})`} />
        <path d="M100 20 L150 80 L100 80 Z" fill="#fff" opacity="0.32" />
        <path d="M100 20 L50 80 L100 80 Z" fill="#fff" opacity="0.15" />
        <rect x="88" y="170" width="24" height="24" rx="3" fill={`url(#${gradId})`} />
      </>; break;
    case "orb":
      body = <>
        <circle cx="100" cy="85" r="55" fill={`url(#${gradId})`} />
        <ellipse cx="82" cy="66" rx="20" ry="10" fill="#fff" opacity="0.35" />
        <rect x="80" y="140" width="40" height="12" rx="2" fill={`url(#${gradId})`} />
        <rect x="88" y="152" width="24" height="40" rx="3" fill={`url(#${gradId})`} />
      </>; break;
    case "crown":
      body = <>
        <path d="M50 100 L70 40 L90 90 L110 40 L130 90 L150 40 L165 100 L155 160 L45 160 Z" fill={`url(#${gradId})`} />
        <circle cx="70" cy="40" r="8" fill="#fff" opacity="0.9" />
        <circle cx="110" cy="40" r="10" fill="#fff" />
        <circle cx="150" cy="40" r="8" fill="#fff" opacity="0.9" />
        <rect x="45" y="160" width="110" height="14" rx="3" fill="#000" opacity="0.6" />
      </>; break;
    case "wing":
      body = <>
        <path d="M100 30 C 60 60, 30 90, 40 130 C 60 120, 80 110, 100 100 C 120 110, 140 120, 160 130 C 170 90, 140 60, 100 30 Z" fill={`url(#${gradId})`} />
        <path d="M100 30 L100 180" stroke={`url(#${gradId})`} strokeWidth="10" strokeLinecap="round" />
      </>; break;
    case "prism":
      body = <>
        <path d="M100 20 L160 170 L40 170 Z" fill={`url(#${gradId})`} opacity="0.9" />
        <path d="M100 20 L160 170 L100 170 Z" fill="#fff" opacity="0.25" />
        <rect x="88" y="170" width="24" height="24" rx="3" fill={`url(#${gradId})`} />
      </>; break;
    case "tower":
      body = <>
        <path d="M80 30 L120 30 L128 60 L72 60 Z" fill={`url(#${gradId})`} />
        <rect x="78" y="60" width="44" height="110" fill={`url(#${gradId})`} />
        <rect x="90" y="80" width="20" height="20" fill="#000" opacity="0.5" />
        <rect x="90" y="110" width="20" height="20" fill="#000" opacity="0.5" />
        <rect x="90" y="140" width="20" height="20" fill="#000" opacity="0.5" />
      </>; break;
    case "star":
      body = <>
        <path d="M100 20 L118 76 L176 76 L128 108 L146 166 L100 132 L54 166 L72 108 L24 76 L82 76 Z" fill={`url(#${gradId})`} />
        <rect x="88" y="170" width="24" height="20" rx="3" fill={`url(#${gradId})`} />
      </>; break;
  }

  return (
    <svg viewBox="0 0 200 240" className={className}>
      {commonDefs}
      {halo}
      {body}
      {base}
      {shine}
    </svg>
  );
}
