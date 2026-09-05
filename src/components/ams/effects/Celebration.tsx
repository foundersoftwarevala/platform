import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Trophy, Award, Sparkles, Star, Diamond, Gift, ScrollText } from "lucide-react";
import trophy3d from "@/assets/trophy-3d.png";
import medal3d from "@/assets/medal-3d.png";
import badge3d from "@/assets/badge-3d.png";
import {
  playWin, playRankUp, playLevelUp, playDiamond, playFireworks,
  playCoinDrop, playMythic, playRandom, playCertificate,
} from "@/lib/celebrate";
import { getSoundPrefs, playSound, type UiSound } from "@/lib/ams/ui-sound";
import { AnimatedNumber } from "./AnimatedNumber";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
export type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Founder";
export type CelebrateKind =
  | "achievement" | "rankUp" | "levelUp" | "badge" | "trophy"
  | "milestone" | "firstSale" | "founder" | "surprise" | "certificate";

export interface CelebrationPayload {
  kind: CelebrateKind;
  title: string;
  subtitle?: string;
  rarity?: Rarity;
  xp?: number;
}

interface CelebrationCtx {
  celebrate: (p: CelebrationPayload) => void;
  surprise: () => void;
  soundOn: boolean;
  setSoundOn: (b: boolean) => void;
}

const Ctx = createContext<CelebrationCtx | null>(null);
export const useCelebration = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCelebration outside provider");
  return c;
};

// ──────────────────────────────────────────────────────────────
// Particle canvas — GPU-friendly via requestAnimationFrame
// ──────────────────────────────────────────────────────────────
type ParticleStyle = "coin" | "diamond" | "confetti" | "star" | "spark";

interface P {
  x: number; y: number; vx: number; vy: number;
  size: number; rot: number; vr: number; color: string;
  style: ParticleStyle; life: number; maxLife: number;
}

const PALETTE = {
  Common:    ["#c0c0c0", "#e5e4e2", "#94a3b8"],
  Rare:      ["#60a5fa", "#93c5fd", "#bfdbfe"],
  Epic:      ["#c084fc", "#a855f7", "#e9d5ff"],
  Legendary: ["#f5d77a", "#d4a14a", "#fff3c4"],
  Mythic:    ["#ff9b6a", "#d97aff", "#9be5ff"],
  Founder:   ["#fff3c4", "#f5d77a", "#b4892a", "#9be5ff"],
};

function makeBurst(w: number, h: number, rarity: Rarity, style: ParticleStyle, count: number): P[] {
  const colors = PALETTE[rarity];
  const cx = w / 2, cy = h * 0.45;
  const arr: P[] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 10;
    arr.push({
      x: cx + (Math.random() - 0.5) * 80,
      y: cy + (Math.random() - 0.5) * 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      size: 4 + Math.random() * (style === "confetti" ? 8 : 6),
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      style,
      life: 0,
      maxLife: 90 + Math.random() * 60,
    });
  }
  return arr;
}

function makeRain(w: number, h: number, rarity: Rarity, style: ParticleStyle, count: number): P[] {
  const colors = PALETTE[rarity];
  const arr: P[] = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: Math.random() * w,
      y: -Math.random() * h,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 3 + Math.random() * 5,
      size: 5 + Math.random() * 8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.25,
      color: colors[Math.floor(Math.random() * colors.length)],
      style,
      life: 0,
      maxLife: 260 + Math.random() * 120,
    });
  }
  return arr;
}

function drawParticle(ctx: CanvasRenderingContext2D, p: P) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.fillStyle = p.color;
  ctx.shadowBlur = 12;
  ctx.shadowColor = p.color;
  if (p.style === "coin") {
    // gold coin disk
    ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.85, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,243,196,0.7)";
    ctx.beginPath(); ctx.ellipse(-p.size * 0.25, -p.size * 0.25, p.size * 0.35, p.size * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  } else if (p.style === "diamond") {
    ctx.beginPath();
    ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.7, 0); ctx.lineTo(0, p.size); ctx.lineTo(-p.size * 0.7, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath(); ctx.moveTo(0, -p.size * 0.7); ctx.lineTo(p.size * 0.3, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  } else if (p.style === "confetti") {
    ctx.fillRect(-p.size * 0.4, -p.size * 0.7, p.size * 0.8, p.size * 1.4);
  } else if (p.style === "star") {
    const r1 = p.size, r2 = p.size * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? r1 : r2;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.fill();
  } else {
    // spark
    ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ──────────────────────────────────────────────────────────────
// Overlay
// ──────────────────────────────────────────────────────────────
const KIND_META: Record<CelebrateKind, {
  icon: typeof Trophy; title: string; rarity: Rarity; rain: ParticleStyle; burst: ParticleStyle;
  asset: string; sound: () => void; full: boolean;
}> = {
  achievement: { icon: Award,    title: "Achievement Unlocked", rarity: "Epic",      rain: "spark",    burst: "star",     asset: badge3d,   sound: playWin,       full: false },
  rankUp:      { icon: Crown,    title: "Rank Up",              rarity: "Legendary", rain: "coin",     burst: "star",     asset: trophy3d,  sound: playRankUp,    full: true  },
  levelUp:     { icon: Sparkles, title: "Level Up",             rarity: "Rare",      rain: "spark",    burst: "spark",    asset: medal3d,   sound: playLevelUp,   full: false },
  badge:       { icon: Star,     title: "New Badge Earned",     rarity: "Rare",      rain: "spark",    burst: "star",     asset: badge3d,   sound: playWin,       full: false },
  trophy:      { icon: Trophy,   title: "New Trophy Earned",    rarity: "Legendary", rain: "coin",     burst: "star",     asset: trophy3d,  sound: playRankUp,    full: true  },
  milestone:   { icon: Diamond,  title: "Milestone Reached",    rarity: "Legendary", rain: "diamond",  burst: "diamond",  asset: trophy3d,  sound: playDiamond,   full: true  },
  firstSale:   { icon: Gift,     title: "First Sale",           rarity: "Epic",      rain: "coin",     burst: "coin",     asset: trophy3d,  sound: playCoinDrop,  full: true  },
  founder:     { icon: Crown,    title: "Founder Award",        rarity: "Founder",   rain: "diamond",  burst: "star",     asset: trophy3d,  sound: playMythic,    full: true  },
  surprise:    { icon: Sparkles, title: "Surprise Reward",      rarity: "Mythic",    rain: "confetti", burst: "confetti", asset: badge3d,   sound: playRandom,    full: false },
  certificate: { icon: ScrollText, title: "Certificate Issued",  rarity: "Epic",      rain: "spark",    burst: "spark",    asset: medal3d,   sound: playCertificate, full: false },
};

/**
 * Restrained UI cue layered under each celebration, routed through the
 * shared sound system so the global mute / volume control applies.
 * Nothing ever plays without an explicit in-app event.
 */
const UI_CUE: Record<CelebrateKind, UiSound> = {
  achievement: "achievement",
  rankUp: "trophy",
  levelUp: "reward",
  badge: "badge",
  trophy: "trophy",
  milestone: "reward",
  firstSale: "reward",
  founder: "trophy",
  surprise: "reward",
  certificate: "verified",
};

function Overlay({ payload, onClose }: { payload: CelebrationPayload; onClose: () => void }) {
  const meta = KIND_META[payload.kind];
  const rarity: Rarity = payload.rarity ?? meta.rarity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<P[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef(performance.now());
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const w = window.innerWidth, h = window.innerHeight;
    const burstCount = meta.full ? 120 : 70;
    const rainCount = meta.full ? 90 : 40;
    particlesRef.current = [
      ...makeBurst(w, h, rarity, meta.burst, burstCount),
      ...makeRain(w, h, rarity, meta.rain, rainCount),
    ];

    // Fireworks-style secondary bursts for full-screen rarities
    const secondaryTimers: ReturnType<typeof setTimeout>[] = [];
    if (meta.full) {
      [0.6, 1.2].forEach((t) => {
        secondaryTimers.push(setTimeout(() => {
          particlesRef.current.push(...makeBurst(w, h, rarity, "star", 60));
          if (payload.kind === "rankUp" || payload.kind === "founder") playFireworks();
        }, t * 1000));
      });
    }

    const tick = () => {
      const W = window.innerWidth, H = window.innerHeight;
      ctx.clearRect(0, 0, W, H);
      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.vy += 0.18;
        p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        p.life++;
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        drawParticle(ctx, p);
        if (p.y > H + 40 || p.life > p.maxLife) list.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      secondaryTimers.forEach(clearTimeout);
    };
  }, [payload.kind, rarity, meta.full, meta.burst, meta.rain, reduced]);

  // Auto dismiss
  useEffect(() => {
    const t = setTimeout(onClose, meta.full ? 5200 : 3600);
    return () => clearTimeout(t);
  }, [onClose, meta.full]);

  const Icon = meta.icon;
  const ringColor = PALETTE[rarity][0];

  return (
    <div
      onClick={onClose}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
      style={{ background: meta.full ? "radial-gradient(ellipse at center, rgba(8,10,24,0.75), rgba(0,0,0,0.92))" : "radial-gradient(ellipse at center, rgba(8,10,24,0.55), rgba(0,0,0,0.75))", backdropFilter: "blur(8px)" }}
    >
      {!reduced && <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />}

      {/* Spotlight rings */}
      {!reduced && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="absolute h-[60vmin] w-[60vmin] rounded-full opacity-40 animate-[ams-pulse_2.4s_ease-out_infinite]" style={{ background: `radial-gradient(circle, ${ringColor}55 0%, transparent 60%)` }} />
          <div className="absolute h-[40vmin] w-[40vmin] rounded-full opacity-60 animate-[ams-pulse_1.8s_ease-out_infinite]" style={{ background: `radial-gradient(circle, ${ringColor}88 0%, transparent 65%)`, animationDelay: "0.3s" }} />
        </div>
      )}

      {/* Center card */}
      <div className={`relative z-10 mx-4 w-full max-w-md${reduced ? "" : " animate-[ams-pop_0.55s_cubic-bezier(.2,.9,.25,1.2)_both]"}`}>
        <div className="relative overflow-hidden rounded-2xl border border-gold bg-[oklch(0.13_0.025_250)]/95 px-8 pb-7 pt-20 text-center shadow-[0_30px_80px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_oklch(0.78_0.14_82/0.3)]">
          {/* Glint */}
          {!reduced && (
            <div className="pointer-events-none absolute inset-0" style={{
              background: "linear-gradient(115deg, transparent 35%, rgba(255,243,196,0.25) 50%, transparent 65%)",
              mixBlendMode: "screen",
              animation: "ams-glint 2.6s ease-in-out infinite",
            }} />
          )}

          {/* 3D award */}
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative grid h-32 w-32 place-items-center rounded-full" style={{ background: `radial-gradient(circle, ${ringColor}44, transparent 70%)` }}>
              <img src={meta.asset} alt="" className={`h-28 w-28 drop-shadow-[0_10px_30px_rgba(245,215,122,0.6)]${reduced ? "" : " award-3d"}`} />

            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.3em]" style={{ color: ringColor }}>
            <Icon className="h-3 w-3" /> {rarity} · {meta.title}
          </div>
          <h2 className="mt-2 font-display text-3xl font-semibold text-gold-gradient">{payload.title}</h2>
          {payload.subtitle && <p className="mt-2 text-sm text-muted-foreground">{payload.subtitle}</p>}

          {typeof payload.xp === "number" && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold bg-[oklch(0.18_0.03_250)] px-4 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-[#f5d77a]" />
              <span className="font-semibold text-[#f5d77a]">+<AnimatedNumber value={payload.xp} duration={900} /> XP</span>
            </div>
          )}

          <div className="mt-6 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tap anywhere to dismiss</div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────────────────────
export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<CelebrationPayload[]>([]);
  const [soundOn, setSoundOn] = useState(true);

  const celebrate = useCallback((p: CelebrationPayload) => {
    setQueue((q) => [...q, p]);
    if (soundOn && getSoundPrefs().enabled) {
      try {
        KIND_META[p.kind].sound();
        playSound(UI_CUE[p.kind]);
      } catch { /* ignore */ }
    }
  }, [soundOn]);

  const surprise = useCallback(() => {
    const kinds: CelebrateKind[] = ["achievement", "levelUp", "badge", "trophy", "milestone", "rankUp", "surprise"];
    const k = kinds[Math.floor(Math.random() * kinds.length)];
    const titles: Record<CelebrateKind, string> = {
      achievement: "Hidden Achievement",
      levelUp:     "Bonus Level Up",
      badge:       "Mystery Badge",
      trophy:      "Surprise Trophy",
      milestone:   "Lucky Milestone",
      rankUp:      "Rank Boost",
      firstSale:   "First Sale",
      founder:     "Founder Pick",
      certificate: "Certificate Issued",
      surprise:    "Mystery Reward",
    };
    celebrate({ kind: k, title: titles[k], subtitle: "From the AMS surprise engine.", xp: 50 + Math.floor(Math.random() * 950) });
  }, [celebrate]);

  const current = queue[0];
  const close = useCallback(() => setQueue((q) => q.slice(1)), []);

  const value = useMemo(() => ({ celebrate, surprise, soundOn, setSoundOn }), [celebrate, surprise, soundOn]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && <Overlay key={queue.length} payload={current} onClose={close} />}
      <style>{`
        @keyframes ams-pop {
          0% { transform: scale(0.6) translateY(20px); opacity: 0; }
          60% { transform: scale(1.05) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes ams-pulse {
          0% { transform: scale(0.6); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes ams-glint {
          0% { transform: translateX(-120%) skewX(-20deg); }
          100% { transform: translateX(220%) skewX(-20deg); }
        }
      `}</style>
    </Ctx.Provider>
  );
}
