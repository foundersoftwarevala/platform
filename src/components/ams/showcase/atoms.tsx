// A curated set of luxury UI atoms driven by a RoleTheme. Everything is
// SVG or CSS so nothing repeats visually across roles.

import type { RoleTheme } from "@/lib/ams/role-themes";
import { RolePattern } from "./RolePattern";

/* ─────────── Membership / Identity card ─────────── */
export function MembershipCard({ theme, name, id, tier }: { theme: RoleTheme; name: string; id: string; tier: string }) {
  return (
    <div
      className="relative aspect-[1.586/1] w-full max-w-sm rounded-2xl overflow-hidden border"
      style={{
        background: theme.cover,
        borderColor: `${theme.primary}55`,
        boxShadow: `0 30px 60px -30px ${theme.glow}, inset 0 0 0 1px ${theme.primary}22`,
        fontFamily: theme.bodyFont,
      }}
    >
      <RolePattern kind={theme.pattern} color={theme.primary} id={`mc-${theme.slug}`}
        className="absolute inset-0 h-full w-full" opacity={0.18} />
      {/* holo strip */}
      <div className="absolute inset-x-6 top-4 h-1 rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.primary}, ${theme.accent}, ${theme.primary}, transparent)` }} />
      {/* chip */}
      <div className="absolute left-6 top-10 h-10 w-14 rounded"
        style={{ background: theme.metallic, boxShadow: `inset 0 0 0 1px ${theme.primary}55` }}>
        <div className="grid grid-cols-3 grid-rows-3 gap-[2px] h-full w-full p-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} style={{ background: `${theme.ink}44` }} />
          ))}
        </div>
      </div>
      {/* glyph */}
      <div className="absolute right-4 top-3 text-2xl" style={{ color: theme.primary, fontFamily: theme.displayFont }}>
        {theme.glyphIcon}
      </div>
      <div className="absolute left-6 bottom-16 text-[9px] tracking-[0.3em] uppercase" style={{ color: `${theme.primary}bb` }}>
        {tier}
      </div>
      <div className="absolute left-6 bottom-8 text-lg text-white font-medium tracking-wide" style={{ fontFamily: theme.displayFont }}>
        {name}
      </div>
      <div className="absolute left-6 bottom-3 text-[10px] font-mono" style={{ color: `${theme.primary}cc` }}>
        {id}
      </div>
      <div className="absolute right-4 bottom-3 text-[9px] tracking-widest uppercase" style={{ color: `${theme.accent}bb` }}>
        Sovereign · {theme.environmentLabel}
      </div>
    </div>
  );
}

/* ─────────── Digital Passport (cover + spread) ─────────── */
export function Passport({ theme, name, id }: { theme: RoleTheme; name: string; id: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Cover */}
      <div
        className="relative aspect-[3/4] rounded-lg overflow-hidden"
        style={{
          background: theme.leather,
          boxShadow: `0 30px 60px -20px ${theme.glow}, inset 0 0 0 1px ${theme.primary}55, inset 0 0 40px ${theme.primary}18`,
          fontFamily: theme.displayFont,
        }}
      >
        <RolePattern kind={theme.pattern} color={theme.primary} id={`pc-${theme.slug}`}
          className="absolute inset-0 h-full w-full" opacity={0.10} />
        {/* embossed border */}
        <div className="absolute inset-4 rounded border-2" style={{ borderColor: `${theme.primary}66` }} />
        <div className="absolute inset-6 rounded border" style={{ borderColor: `${theme.primary}33` }} />
        {/* crest glyph */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6">
          <div className="text-[9px] tracking-[0.4em] uppercase" style={{ color: `${theme.primary}aa` }}>Sovereign Ledger</div>
          <div className="text-6xl" style={{ color: theme.primary, textShadow: `0 0 30px ${theme.glow}` }}>{theme.glyphIcon}</div>
          <div className="text-lg text-white/95">Digital Passport</div>
          <div className="text-[10px] uppercase tracking-widest" style={{ color: `${theme.accent}cc` }}>{theme.environmentLabel}</div>
        </div>
        {/* metallic corner */}
        <div className="absolute top-3 right-3 h-6 w-6 rounded-sm" style={{ background: theme.metallic }} />
      </div>

      {/* Spread */}
      <div
        className="relative aspect-[3/4] rounded-lg overflow-hidden border p-5 flex flex-col justify-between"
        style={{ background: theme.paper, borderColor: `${theme.primary}55`, fontFamily: theme.bodyFont }}
      >
        <RolePattern kind={theme.pattern} color={theme.primary} id={`pp-${theme.slug}`}
          className="absolute inset-0 h-full w-full" opacity={0.08} />
        {/* watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.06 }}>
          <div className="text-[220px] leading-none" style={{ color: theme.primary, fontFamily: theme.displayFont }}>
            {theme.glyphIcon}
          </div>
        </div>

        <div className="relative flex items-start justify-between">
          <div>
            <div className="text-[9px] tracking-[0.3em] uppercase" style={{ color: `${theme.primary}bb` }}>Holder</div>
            <div className="mt-1 text-xl text-white" style={{ fontFamily: theme.displayFont }}>{name}</div>
            <div className="text-[10px] font-mono mt-0.5" style={{ color: `${theme.primary}cc` }}>{id}</div>
          </div>
          {/* QR-style block */}
          <div className="h-16 w-16 grid grid-cols-8 grid-rows-8 gap-[1px] p-1 rounded"
            style={{ background: `${theme.primary}18`, border: `1px solid ${theme.primary}44` }}>
            {Array.from({ length: 64 }).map((_, i) => (
              <div key={i} style={{ background: Math.random() > 0.55 ? theme.primary : "transparent" }} />
            ))}
          </div>
        </div>

        {/* stamps */}
        <div className="relative grid grid-cols-3 gap-3">
          {["FIRST STEP", "VERIFIED", "CEREMONY"].map((s, i) => (
            <div key={s} className="aspect-square rounded-full border-2 flex items-center justify-center rotate-[-6deg]"
              style={{
                borderColor: `${theme.primary}88`,
                background: `radial-gradient(circle, ${theme.primary}22, transparent 70%)`,
                transform: `rotate(${i * 8 - 8}deg)`,
              }}>
              <span className="text-[8px] tracking-widest uppercase" style={{ color: theme.primary, fontFamily: theme.displayFont }}>{s}</span>
            </div>
          ))}
        </div>

        <div className="relative flex items-end justify-between">
          <div>
            <div className="text-[9px] tracking-widest uppercase" style={{ color: `${theme.accent}aa` }}>Signature</div>
            <div className="mt-1 h-6 w-32" style={{
              background: `linear-gradient(90deg, transparent, ${theme.primary}88, transparent)`,
              maskImage: "linear-gradient(90deg, black, black 70%, transparent)"
            }} />
          </div>
          <div className="text-right">
            <div className="text-[9px] tracking-widest uppercase" style={{ color: `${theme.accent}aa` }}>Sealed by</div>
            <div className="text-[11px] text-white/85">{theme.environmentLabel}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Medal ─────────── */
export function Medal({ theme, label }: { theme: RoleTheme; label: string }) {
  const [rFrom, rTo] = theme.ribbon;
  const gid = `med-${theme.slug}`;
  const shape = theme.medalShape;
  return (
    <div className="relative flex flex-col items-center">
      {/* Ribbon */}
      <svg viewBox="0 0 120 80" className="w-24">
        <defs>
          <linearGradient id={`${gid}-rib`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={rFrom} />
            <stop offset="100%" stopColor={rTo} />
          </linearGradient>
        </defs>
        <path d="M20 0 L45 60 L60 50 L75 60 L100 0 Z" fill={`url(#${gid}-rib)`} />
        <path d="M45 60 L60 50 L75 60 L60 80 Z" fill={rTo} />
      </svg>
      {/* Medal head */}
      <svg viewBox="0 0 160 160" className="w-32 -mt-6 trophy-float"
        style={{ filter: `drop-shadow(0 12px 26px ${theme.glow})` }}>
        <defs>
          <radialGradient id={`${gid}-face`} cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="45%" stopColor={theme.primary} />
            <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
          </radialGradient>
        </defs>
        {(() => {
          const fill = `url(#${gid}-face)`;
          switch (shape) {
            case "circle": return <circle cx="80" cy="80" r="60" fill={fill} />;
            case "hexagon": return <polygon points="80,20 138,50 138,110 80,140 22,110 22,50" fill={fill} />;
            case "shield": return <path d="M80 20 L138 40 V90 Q138 130 80 145 Q22 130 22 90 V40 Z" fill={fill} />;
            case "star": return <path d="M80 15 L96 60 L142 60 L104 88 L120 132 L80 106 L40 132 L56 88 L18 60 L64 60 Z" fill={fill} />;
            case "octagon": return <polygon points="55,20 105,20 140,55 140,105 105,140 55,140 20,105 20,55" fill={fill} />;
            case "gear": return <g>
              <circle cx="80" cy="80" r="58" fill={fill} />
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                const x = 80 + Math.cos(a) * 68; const y = 80 + Math.sin(a) * 68;
                return <rect key={i} x={x - 6} y={y - 6} width="12" height="12" fill={fill} transform={`rotate(${(a * 180) / Math.PI + 45} ${x} ${y})`} />;
              })}
              <circle cx="80" cy="80" r="18" fill={theme.paper} />
            </g>;
            case "diamond": return <polygon points="80,15 145,80 80,145 15,80" fill={fill} />;
            case "sun": return <g>
              {Array.from({ length: 16 }).map((_, i) => {
                const a = (i / 16) * Math.PI * 2;
                return <line key={i} x1={80 + Math.cos(a) * 55} y1={80 + Math.sin(a) * 55}
                  x2={80 + Math.cos(a) * 74} y2={80 + Math.sin(a) * 74} stroke={theme.primary} strokeWidth="4" strokeLinecap="round" />;
              })}
              <circle cx="80" cy="80" r="50" fill={fill} />
            </g>;
            case "laurel": return <g>
              <circle cx="80" cy="80" r="48" fill={fill} />
              <path d="M32 80 Q 40 50 55 44" stroke={theme.primary} strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M128 80 Q 120 50 105 44" stroke={theme.primary} strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M32 82 Q 40 110 55 116" stroke={theme.primary} strokeWidth="6" fill="none" strokeLinecap="round" />
              <path d="M128 82 Q 120 110 105 116" stroke={theme.primary} strokeWidth="6" fill="none" strokeLinecap="round" />
            </g>;
            case "phoenix": return <g>
              <circle cx="80" cy="80" r="50" fill={fill} />
              <path d="M80 40 C 50 60, 40 90, 60 120 C 70 100, 80 100, 80 80 C 80 100, 90 100, 100 120 C 120 90, 110 60, 80 40 Z"
                fill={theme.accent} opacity="0.9" />
            </g>;
          }
        })()}
        {/* engraving */}
        <text x="80" y="86" textAnchor="middle" fontSize="13" fill={theme.ink}
          style={{ fontFamily: theme.displayFont, letterSpacing: 2 }}>{label.toUpperCase()}</text>
      </svg>
    </div>
  );
}

/* ─────────── Badge ─────────── */
export function Badge({ theme, label }: { theme: RoleTheme; label: string }) {
  const shape = theme.badgeShape;
  const id = `bg-${theme.slug}`;
  return (
    <svg viewBox="0 0 140 160" className="w-24" style={{ filter: `drop-shadow(0 10px 20px ${theme.glow})` }}>
      <defs>
        <radialGradient id={`${id}-fill`} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="40%" stopColor={theme.primary} />
          <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
        </radialGradient>
      </defs>
      {(() => {
        const fill = `url(#${id}-fill)`;
        switch (shape) {
          case "shield": return <path d="M70 10 L125 30 V80 Q125 130 70 150 Q15 130 15 80 V30 Z" fill={fill} stroke={theme.accent} strokeWidth="2" />;
          case "hex": return <polygon points="70,10 125,40 125,110 70,140 15,110 15,40" fill={fill} stroke={theme.accent} strokeWidth="2" />;
          case "circle": return <circle cx="70" cy="75" r="60" fill={fill} stroke={theme.accent} strokeWidth="2" />;
          case "starburst": return <g>
            <path d="M70 8 L84 46 L124 46 L92 70 L106 110 L70 86 L34 110 L48 70 L16 46 L56 46 Z" fill={fill} stroke={theme.accent} strokeWidth="2" />
          </g>;
          case "gear": return <g>
            <circle cx="70" cy="75" r="58" fill={fill} stroke={theme.accent} strokeWidth="2" />
            {Array.from({ length: 10 }).map((_, i) => {
              const a = (i / 10) * Math.PI * 2;
              const x = 70 + Math.cos(a) * 66; const y = 75 + Math.sin(a) * 66;
              return <rect key={i} x={x - 5} y={y - 5} width="10" height="10" fill={theme.primary} />;
            })}
          </g>;
          case "sun": return <g>
            {Array.from({ length: 14 }).map((_, i) => {
              const a = (i / 14) * Math.PI * 2;
              return <polygon key={i}
                points={`${70 + Math.cos(a) * 50},${75 + Math.sin(a) * 50} ${70 + Math.cos(a + 0.1) * 78},${75 + Math.sin(a + 0.1) * 78} ${70 + Math.cos(a - 0.1) * 78},${75 + Math.sin(a - 0.1) * 78}`}
                fill={theme.primary} opacity="0.9" />;
            })}
            <circle cx="70" cy="75" r="46" fill={fill} />
          </g>;
          case "crest": return <path d="M70 10 L120 30 L118 90 Q118 118 70 150 Q22 118 22 90 L20 30 Z"
            fill={fill} stroke={theme.accent} strokeWidth="2" />;
        }
      })()}
      <text x="70" y="80" textAnchor="middle" fontSize="42" fill={theme.ink}
        style={{ fontFamily: theme.displayFont }}>{theme.glyphIcon}</text>
      <text x="70" y="100" textAnchor="middle" fontSize="8" fill={theme.ink}
        style={{ fontFamily: theme.displayFont, letterSpacing: 2 }}>{label.toUpperCase()}</text>
    </svg>
  );
}

/* ─────────── Award plate (framed) ─────────── */
export function AwardPlate({ theme, title, subtitle }: { theme: RoleTheme; title: string; subtitle: string }) {
  return (
    <div className="relative rounded-xl p-6 border overflow-hidden"
      style={{
        background: theme.leather, borderColor: `${theme.primary}66`,
        boxShadow: `0 30px 60px -30px ${theme.glow}, inset 0 0 0 6px ${theme.paper}, inset 0 0 0 7px ${theme.primary}55`,
      }}>
      <RolePattern kind={theme.pattern} color={theme.primary} id={`aw-${theme.slug}`}
        className="absolute inset-0 h-full w-full" opacity={0.06} />
      <div className="relative flex items-center gap-4">
        <div className="h-16 w-16 rounded-md flex items-center justify-center text-3xl"
          style={{ background: theme.metallic, color: theme.ink, fontFamily: theme.displayFont }}>
          {theme.glyphIcon}
        </div>
        <div>
          <div className="text-[9px] tracking-[0.3em] uppercase" style={{ color: `${theme.primary}bb` }}>Presented</div>
          <div className="text-lg text-white" style={{ fontFamily: theme.displayFont }}>{title}</div>
          <div className="text-[11px]" style={{ color: `${theme.accent}cc`, fontFamily: theme.bodyFont }}>{subtitle}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Certificate ─────────── */
export function Certificate({ theme, holder, title }: { theme: RoleTheme; holder: string; title: string }) {
  return (
    <div className="relative aspect-[1.414/1] rounded-lg overflow-hidden border-8 p-6 flex flex-col items-center justify-center text-center"
      style={{
        background: `linear-gradient(180deg, #f7f2e6, #ede4cc)`,
        borderColor: theme.ink,
        boxShadow: `0 30px 60px -30px ${theme.glow}, inset 0 0 0 2px ${theme.primary}, inset 0 0 0 12px transparent, inset 0 0 40px ${theme.primary}22`,
        fontFamily: theme.displayFont,
      }}>
      {/* gold-foil corners */}
      {["top-left","top-right","bottom-left","bottom-right"].map((pos) => (
        <div key={pos} className={`absolute h-8 w-8 ${pos.replace("-", "-")}`}
          style={{
            top: pos.startsWith("top") ? 8 : "auto", bottom: pos.startsWith("bottom") ? 8 : "auto",
            left: pos.endsWith("left") ? 8 : "auto", right: pos.endsWith("right") ? 8 : "auto",
            background: theme.metallic,
            clipPath: "polygon(0 0, 100% 0, 100% 20%, 20% 20%, 20% 100%, 0 100%)",
            transform: pos === "top-right" ? "scaleX(-1)" : pos === "bottom-left" ? "scaleY(-1)" : pos === "bottom-right" ? "scale(-1)" : undefined,
          }} />
      ))}
      <RolePattern kind={theme.pattern} color={theme.ink} id={`ct-${theme.slug}`}
        className="absolute inset-0 h-full w-full" opacity={0.05} />
      <div className="relative">
        <div className="text-[10px] tracking-[0.4em] uppercase" style={{ color: theme.ink }}>Certificate of Achievement</div>
        <div className="mt-3 text-3xl" style={{ color: theme.ink }}>{holder}</div>
        <div className="mt-1 text-[11px] italic" style={{ color: `${theme.ink}bb`, fontFamily: theme.bodyFont }}>is hereby recognized as</div>
        <div className="mt-2 text-xl" style={{ color: theme.secondary }}>{title}</div>
        <div className="mt-3 mx-auto h-px w-40" style={{ background: theme.ink }} />
        <div className="mt-4 flex items-center justify-between gap-8 text-[10px] uppercase tracking-widest" style={{ color: `${theme.ink}aa` }}>
          <div>
            <div className="h-6 w-24 mx-auto" style={{
              background: `linear-gradient(90deg, transparent, ${theme.ink}, transparent)`,
              maskImage: "linear-gradient(90deg, black, black 70%, transparent)",
            }} />
            <div className="mt-1">Signature</div>
          </div>
          <div className="h-14 w-14 rounded-full border-2 flex items-center justify-center"
            style={{ borderColor: theme.secondary, background: `radial-gradient(${theme.primary}44, transparent 70%)` }}>
            <span style={{ color: theme.secondary, fontFamily: theme.displayFont }}>{theme.glyphIcon}</span>
          </div>
          <div>
            <div className="h-6 w-24 mx-auto grid grid-cols-6 grid-rows-6 gap-[1px]"
              style={{ background: `${theme.ink}18`, padding: 1 }}>
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} style={{ background: Math.random() > 0.5 ? theme.ink : "transparent" }} />
              ))}
            </div>
            <div className="mt-1">Verify</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Trophy Cabinet ─────────── */
export function TrophyCabinet({ theme, tiers }: { theme: RoleTheme; tiers: { label: string; hue: string }[] }) {
  return (
    <div className="relative rounded-2xl border overflow-hidden"
      style={{
        borderColor: `${theme.primary}55`,
        background: `linear-gradient(180deg, ${theme.paper}, ${theme.ink})`,
        boxShadow: `inset 0 0 60px ${theme.primary}18`,
      }}>
      <div className="relative grid grid-cols-4 divide-x divide-y"
        style={{ borderColor: `${theme.primary}22` }}>
        {tiers.map((t, i) => (
          <div key={i} className="aspect-square relative flex items-end justify-center p-3"
            style={{
              background: `radial-gradient(closest-side at 50% 30%, ${t.hue}55, transparent 70%)`,
              borderColor: `${theme.primary}22`,
            }}>
            {/* glass reflection */}
            <div className="absolute inset-x-0 top-0 h-1/2"
              style={{ background: `linear-gradient(180deg, ${theme.primary}22, transparent)` }} />
            {/* mini trophy */}
            <svg viewBox="0 0 40 60" className="h-16 trophy-float"
              style={{ animationDelay: `${i * 0.35}s`, filter: `drop-shadow(0 6px 12px ${t.hue}88)` }}>
              <defs>
                <linearGradient id={`cab-${theme.slug}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
                  <stop offset="45%" stopColor={t.hue} />
                  <stop offset="100%" stopColor="#000" stopOpacity="0.9" />
                </linearGradient>
              </defs>
              <path d="M8 6 h24 v12 a12 12 0 0 1 -24 0 z" fill={`url(#cab-${theme.slug}-${i})`} />
              <rect x="17" y="30" width="6" height="18" fill={`url(#cab-${theme.slug}-${i})`} />
              <rect x="10" y="48" width="20" height="6" rx="1" fill={`url(#cab-${theme.slug}-${i})`} />
            </svg>
            <div className="absolute bottom-1 left-2 right-2 text-[8px] uppercase tracking-widest text-center truncate"
              style={{ color: t.hue }}>{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Avatar with animated frame ─────────── */
export function AvatarFrame({ theme, initials }: { theme: RoleTheme; initials: string }) {
  return (
    <div className="relative h-28 w-28">
      {/* rotating outer ring */}
      <div className="absolute inset-0 rounded-full trophy-rotate"
        style={{
          background: `conic-gradient(from 0deg, ${theme.primary}, ${theme.accent}, ${theme.secondary}, ${theme.primary})`,
          padding: 3,
        }}>
        <div className="h-full w-full rounded-full" style={{ background: theme.paper }} />
      </div>
      {/* inner glass */}
      <div className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center"
        style={{
          background: `radial-gradient(circle at 30% 25%, ${theme.primary}55, ${theme.paper} 65%)`,
          boxShadow: `inset 0 0 20px ${theme.primary}44`,
          fontFamily: theme.displayFont,
        }}>
        <span className="text-3xl text-white/90">{initials}</span>
      </div>
      {/* verification seal */}
      <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full flex items-center justify-center border"
        style={{ background: theme.metallic, borderColor: theme.ink, color: theme.ink, fontFamily: theme.displayFont }}>
        <span className="text-sm">✓</span>
      </div>
    </div>
  );
}
