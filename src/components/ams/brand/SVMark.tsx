// Software Vala brand identity layer for collectibles.
// Subtle, engraved, luxury — never advertising. Rolex/Ferrari restraint:
// an etched SV monogram seal, micro-engraved wordmark and a collection number.

export function SVSeal({
  accent,
  size = 26,
  title = "Software Vala Verification Seal",
}: { accent: string; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title}
      className="pointer-events-none"
      style={{ filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.6))` }}
    >
      <defs>
        <linearGradient id="sv-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`${accent}`} stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor={`${accent}`} stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {/* milled outer rim */}
      <circle cx="24" cy="24" r="22" fill="none" stroke="url(#sv-metal)" strokeWidth="1.6" opacity="0.9" />
      <circle cx="24" cy="24" r="18.5" fill="none" stroke="url(#sv-metal)" strokeWidth="0.6" opacity="0.6" />
      {Array.from({ length: 36 }).map((_, i) => {
        const a = (i / 36) * Math.PI * 2;
        const x1 = 24 + Math.cos(a) * 19.2;
        const y1 = 24 + Math.sin(a) * 19.2;
        const x2 = 24 + Math.cos(a) * 21.2;
        const y2 = 24 + Math.sin(a) * 21.2;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="0.5" opacity="0.45" />;
      })}
      {/* engraved SV monogram */}
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        letterSpacing="0.5"
        fill="url(#sv-metal)"
        style={{ fontFamily: "ui-serif, Georgia, serif" }}
      >
        SV
      </text>
    </svg>
  );
}

/** Micro-engraved Software Vala wordmark used along frames and back plates. */
export function SVMicroMark({ accent, className = "" }: { accent: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none select-none font-mono uppercase ${className}`}
      style={{
        color: `${accent}99`,
        fontSize: 6,
        letterSpacing: "0.42em",
        textShadow: "0 1px 0 rgba(0,0,0,0.7)",
      }}
    >
      SOFTWARE VALA
    </span>
  );
}

/** Deterministic Software Vala collection number, e.g. SV·DEV·0142. */
export function svCollectionNumber(seed: string, prefix: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (Math.abs(h) % 8999) + 1000;
  return `SV·${prefix.toUpperCase()}·${n}`;
}

/**
 * Museum glass-case overlay: laminated glass reflection, edge bevel and a
 * brushed-metal plinth line, so every collectible reads as a real object
 * behind display glass rather than a flat image.
 */
export function MuseumCase({ accent }: { accent: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5]">
      {/* glass sheet reflection */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(118deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 22%, transparent 38%, transparent 62%, rgba(255,255,255,0.05) 82%, rgba(255,255,255,0.12) 100%)",
          mixBlendMode: "screen",
        }}
      />
      {/* inner bevel of the case */}
      <div
        className="absolute inset-[3px] rounded-[14px]"
        style={{ boxShadow: `inset 0 0 0 1px ${accent}33, inset 0 18px 40px -28px #ffffff55` }}
      />
      {/* plinth */}
      <div
        className="absolute inset-x-0 bottom-0 h-8"
        style={{
          background: `linear-gradient(180deg, transparent, ${accent}14 40%, #05070d 100%)`,
          borderTop: `1px solid ${accent}33`,
        }}
      />
    </div>
  );
}
