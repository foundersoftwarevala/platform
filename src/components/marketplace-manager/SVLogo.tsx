import { useCallback, useRef, useState } from "react";

type Particle = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  drift: number;
  kind: "coin" | "gold" | "star" | "xp" | "diamond" | "crown" | "revenue";
  size: number;
};

const KINDS: Particle["kind"][] = ["coin", "gold", "star", "xp", "diamond", "crown", "revenue"];

let pid = 0;

function ParticleGlyph({ kind, size }: { kind: Particle["kind"]; size: number }) {
  const s = size;
  switch (kind) {
    case "coin":
    case "gold":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" className="drop-shadow-[0_2px_6px_oklch(0.85_0.16_92/0.7)]">
          <defs>
            <radialGradient id={`g${kind}`} cx="50%" cy="40%">
              <stop offset="0%" stopColor="oklch(0.96 0.10 95)" />
              <stop offset="100%" stopColor="oklch(0.70 0.14 75)" />
            </radialGradient>
          </defs>
          <circle cx="12" cy="12" r="10" fill={`url(#g${kind})`} stroke="oklch(0.55 0.12 70)" strokeWidth="1" />
          <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="900" fill="oklch(0.35 0.08 60)">$</text>
        </svg>
      );
    case "star":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path d="M12 2l2.9 6.9L22 10l-5.5 4.8L18 22l-6-3.6L6 22l1.5-7.2L2 10l7.1-1.1z"
            fill="oklch(0.85 0.16 92)" stroke="oklch(0.55 0.12 70)" strokeWidth="0.5" />
        </svg>
      );
    case "xp":
      return (
        <div style={{ width: s, height: s * 0.6 }} className="flex items-center justify-center rounded-md bg-gradient-to-br from-[oklch(0.85_0.16_92)] to-[oklch(0.70_0.14_75)] px-1 text-[10px] font-black text-[oklch(0.20_0.05_240)] shadow-[0_2px_8px_oklch(0.85_0.16_92/0.6)]">
          +XP
        </div>
      );
    case "diamond":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path d="M6 3h12l4 6-10 12L2 9z" fill="oklch(0.85 0.18 200)" stroke="oklch(0.55 0.15 200)" strokeWidth="0.6" />
          <path d="M6 3l6 6 6-6M2 9h20" stroke="oklch(0.95 0.05 200)" strokeWidth="0.5" fill="none" />
        </svg>
      );
    case "crown":
      return (
        <svg width={s} height={s} viewBox="0 0 24 24">
          <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z" fill="oklch(0.85 0.16 92)" stroke="oklch(0.45 0.10 70)" strokeWidth="0.7" />
          <circle cx="7" cy="8" r="1.2" fill="oklch(0.85 0.18 200)" />
          <circle cx="12" cy="5" r="1.2" fill="oklch(0.78 0.17 152)" />
          <circle cx="17" cy="8" r="1.2" fill="oklch(0.85 0.18 200)" />
        </svg>
      );
    case "revenue":
      return (
        <div style={{ height: s * 0.6 }} className="flex items-center justify-center rounded-md bg-gradient-to-br from-[oklch(0.78_0.17_152)] to-[oklch(0.55_0.14_152)] px-1.5 text-[10px] font-black text-white shadow-[0_2px_8px_oklch(0.78_0.17_152/0.6)]">
          +$
        </div>
      );
  }
}

export function SVLogo({ onClick }: { onClick?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const wrapRef = useRef<HTMLButtonElement>(null);

  const burst = useCallback(() => {
    const next: Particle[] = Array.from({ length: 36 }).map((_, i) => ({
      id: ++pid,
      left: 50 + (Math.random() - 0.5) * 30,
      delay: Math.random() * 0.15,
      duration: 1.4 + Math.random() * 1.4,
      rotate: (Math.random() - 0.5) * 720,
      drift: (Math.random() - 0.5) * 240,
      kind: KINDS[i % KINDS.length],
      size: 14 + Math.random() * 14,
    }));
    setParticles((p) => [...p, ...next]);
    window.setTimeout(() => {
      setParticles((p) => p.filter((x) => !next.find((n) => n.id === x.id)));
    }, 3200);
    onClick?.();
  }, [onClick]);

  return (
    <>
      <button
        ref={wrapRef}
        onClick={burst}
        aria-label="Software Vala"
        className="group relative flex h-10 items-center gap-2.5 rounded-xl pl-1 pr-3 transition-transform active:scale-[0.97]"
      >
        <span
          className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.50_0.09_215)] via-[oklch(0.62_0.14_205)] to-[oklch(0.80_0.13_192)] shadow-[0_0_0_1px_oklch(1_0_0/0.10),0_8px_24px_-8px_oklch(0.80_0.13_192/0.7),inset_0_1px_0_oklch(1_0_0/0.30)]"
        >
          <span className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_25%,oklch(1_0_0/0.45),transparent_55%)] opacity-80" />
          <svg viewBox="0 0 24 24" className="relative h-5 w-5" aria-hidden>
            <defs>
              <linearGradient id="svlg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.99 0.01 200)" />
                <stop offset="100%" stopColor="oklch(0.85 0.16 92)" />
              </linearGradient>
            </defs>
            <path
              d="M7 6.5C7 5 8.2 4 10 4h7l-1.4 2.6H10.2c-.5 0-.8.3-.8.7 0 .4.3.7.8.8l4.6.7c2 .3 3.2 1.6 3.2 3.3 0 2.1-1.7 3.5-4.1 3.5H6l1.4-2.6h6.2c.6 0 1-.3 1-.8s-.4-.8-1-.9l-4.5-.7C7.1 10.4 7 8.2 7 6.5z"
              fill="url(#svlg)"
            />
            <path d="M5 19h14" stroke="oklch(0.85 0.16 92)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="pointer-events-none absolute -inset-1 rounded-2xl bg-[oklch(0.80_0.13_192/0.0)] transition-all duration-500 group-hover:bg-[oklch(0.80_0.13_192/0.18)] group-hover:blur-md" />
        </span>
        <span className="hidden flex-col items-start leading-tight md:flex">
          <span className="text-[9px] font-black uppercase tracking-[0.28em] text-[oklch(0.85_0.16_92)]">Software</span>
          <span className="-mt-0.5 text-[13px] font-black tracking-tight text-foreground">
            Vala<span className="text-accent">.</span>
          </span>
        </span>
      </button>

      {/* Full-viewport particle layer */}
      {particles.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute -top-8 animate-sv-fall"
              style={{
                left: `${p.left}%`,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                ["--sv-rot" as never]: `${p.rotate}deg`,
                ["--sv-drift" as never]: `${p.drift}px`,
              }}
            >
              <ParticleGlyph kind={p.kind} size={p.size} />
            </span>
          ))}
        </div>
      )}
    </>
  );
}
