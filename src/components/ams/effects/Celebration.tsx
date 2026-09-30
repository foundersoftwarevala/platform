import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import { Crown, Trophy, Award, Sparkles, Star, Diamond, Gift, ScrollText, IdCard, Medal, X } from "lucide-react";
import { toast } from "sonner";
import trophy3d from "@/assets/trophy-3d.png";
import medal3d from "@/assets/medal-3d.png";
import badge3d from "@/assets/badge-3d.png";
import passport3d from "@/assets/passport-3d.png";
import {
  playWin, playRankUp, playLevelUp, playDiamond,
  playCoinDrop, playMythic, playCertificate,
} from "@/lib/celebrate";
import { playUnlock, type UnlockPreset } from "@/lib/ams/trophy-sounds";
import { getSoundPrefs, playSound, setSoundPrefs, subscribeSoundPrefs } from "@/lib/ams/ui-sound";
import { recognitionArt } from "@/lib/ams/recognition-assets";
import { AnimatedNumber } from "./AnimatedNumber";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
export type Rarity = "Common" | "Rare" | "Epic" | "Legendary" | "Mythic" | "Founder";
export type CelebrateKind =
  | "achievement" | "rankUp" | "levelUp" | "badge" | "trophy"
  | "milestone" | "firstSale" | "founder" | "surprise" | "certificate"
  | "xp" | "medal" | "award" | "stage" | "legendary" | "legacy" | "passport";

export interface CelebrationPayload {
  kind: CelebrateKind;
  title: string;
  subtitle?: string;
  rarity?: Rarity;
  xp?: number;
  /** A specific unlock voice (a trophy stage's tier) instead of the kind's own. */
  unlock?: UnlockPreset;
  /** The caller plays its own sound (an award's uploaded sound in a preview). */
  silent?: boolean;
  /** Art to show instead of the kind's generic asset. */
  asset?: string;
  /** Everything else the same moment granted, listed under the headline. */
  extras?: string[];
  /** A line about what comes next. */
  next?: string;
}

/**
 * One recognition exactly as the server describes it (ams_recognition_payload):
 * built from the ledger line and the catalogue, never from anything a screen
 * was told.
 */
export interface Recognition {
  ledger_id: string;
  role: string;
  type: string;
  tier: "standard" | "legendary" | "legacy";
  name: string;
  description: string | null;
  reason: string | null;
  rarity: string | null;
  stage: number | null;
  previous_stage: number | null;
  rank: string | null;
  level: string | null;
  xp: number;
  total_xp: number;
  priority: number | null;
  next: { stage: number; title: string; min_xp: number } | null;
  created_at: string;
}

interface CelebrationCtx {
  /** A presentation someone asked to see: a preview or a showcase unlock. */
  celebrate: (p: CelebrationPayload) => void;
  /** Real recognitions the server granted and this screen has claimed. */
  presentRecognitions: (items: Recognition[]) => void;
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
  achievement: { icon: Award,      title: "Achievement Unlocked", rarity: "Epic",      rain: "spark",    burst: "star",     asset: badge3d,    sound: playWin,                     full: false },
  rankUp:      { icon: Crown,      title: "Rank Up",              rarity: "Legendary", rain: "coin",     burst: "star",     asset: trophy3d,   sound: playRankUp,                  full: true  },
  levelUp:     { icon: Sparkles,   title: "Level Up",             rarity: "Rare",      rain: "spark",    burst: "spark",    asset: medal3d,    sound: playLevelUp,                 full: false },
  badge:       { icon: Star,       title: "New Badge Earned",     rarity: "Rare",      rain: "spark",    burst: "star",     asset: badge3d,    sound: () => playSound("badge"),    full: false },
  trophy:      { icon: Trophy,     title: "New Trophy Earned",    rarity: "Legendary", rain: "coin",     burst: "star",     asset: trophy3d,   sound: () => playUnlock("gold"),    full: true  },
  milestone:   { icon: Diamond,    title: "Milestone Reached",    rarity: "Legendary", rain: "diamond",  burst: "diamond",  asset: trophy3d,   sound: playDiamond,                 full: true  },
  firstSale:   { icon: Gift,       title: "First Sale",           rarity: "Epic",      rain: "coin",     burst: "coin",     asset: trophy3d,   sound: playCoinDrop,                full: true  },
  founder:     { icon: Crown,      title: "Founder Award",        rarity: "Founder",   rain: "diamond",  burst: "star",     asset: trophy3d,   sound: playMythic,                  full: true  },
  surprise:    { icon: Sparkles,   title: "Reward",               rarity: "Mythic",    rain: "confetti", burst: "confetti", asset: badge3d,    sound: () => playSound("reward"),   full: false },
  certificate: { icon: ScrollText, title: "Certificate Issued",   rarity: "Epic",      rain: "spark",    burst: "spark",    asset: medal3d,    sound: playCertificate,             full: false },
  xp:          { icon: Sparkles,   title: "XP Earned",            rarity: "Common",    rain: "spark",    burst: "spark",    asset: medal3d,    sound: () => playSound("success"),  full: false },
  medal:       { icon: Medal,      title: "Medal Earned",         rarity: "Rare",      rain: "coin",     burst: "star",     asset: medal3d,    sound: () => playUnlock("silver"),  full: false },
  award:       { icon: Award,      title: "Award Earned",         rarity: "Epic",      rain: "coin",     burst: "star",     asset: medal3d,    sound: () => playUnlock("gold"),    full: true  },
  stage:       { icon: Crown,      title: "Stage Promotion",      rarity: "Legendary", rain: "coin",     burst: "star",     asset: trophy3d,   sound: playLevelUp,                 full: true  },
  legendary:   { icon: Crown,      title: "Legendary Recognition",rarity: "Legendary", rain: "diamond",  burst: "star",     asset: trophy3d,   sound: () => playUnlock("legend"),  full: true  },
  legacy:      { icon: Crown,      title: "Legacy",               rarity: "Founder",   rain: "diamond",  burst: "star",     asset: trophy3d,   sound: () => playUnlock("founder"), full: true  },
  passport:    { icon: IdCard,     title: "Passport Issued",      rarity: "Rare",      rain: "spark",    burst: "spark",    asset: passport3d, sound: () => playSound("verified"), full: false },
};

/** One sound per presentation, when it starts - never when it is queued. */
function playCue(p: CelebrationPayload) {
  if (p.silent) return;
  try {
    if (p.unlock) playUnlock(p.unlock);
    else KIND_META[p.kind].sound();
  } catch {
    /* sound is best-effort; the presentation still shows */
  }
}

function Overlay({
  payload, onClose, onSkipAll, waiting,
}: {
  payload: CelebrationPayload; onClose: () => void; onSkipAll: () => void; waiting: number;
}) {
  const meta = KIND_META[payload.kind];
  const rarity: Rarity = payload.rarity ?? meta.rarity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<P[]>([]);
  const rafRef = useRef<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const titleId = useId();
  const played = useRef(false);

  // The sound belongs to the moment the presentation begins.
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    playCue(payload);
  }, [payload]);

  // Keyboard: focus the close button, Escape dismisses, focus goes back.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

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
    // Fewer particles on a phone-sized screen: the same effect, half the work.
    const small = w < 640;
    const burstCount = (meta.full ? 120 : 70) / (small ? 2 : 1);
    const rainCount = (meta.full ? 90 : 40) / (small ? 2 : 1);
    particlesRef.current = [
      ...makeBurst(w, h, rarity, meta.burst, burstCount),
      ...makeRain(w, h, rarity, meta.rain, rainCount),
    ];

    // Fireworks-style secondary bursts for full-screen rarities. Visual only:
    // the presentation has already made its one sound.
    const secondaryTimers: ReturnType<typeof setTimeout>[] = [];
    if (meta.full) {
      [0.6, 1.2].forEach((t) => {
        secondaryTimers.push(setTimeout(() => {
          particlesRef.current.push(...makeBurst(w, h, rarity, "star", small ? 30 : 60));
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

  // Auto dismiss; longer when there is more to read.
  useEffect(() => {
    const extra = Math.min(3, payload.extras?.length ?? 0) * 700;
    const t = setTimeout(onClose, (meta.full ? 5200 : 3600) + extra);
    return () => clearTimeout(t);
  }, [onClose, meta.full, payload.extras?.length]);

  const Icon = meta.icon;
  const ringColor = PALETTE[rarity][0];

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-recognition-overlay={payload.kind}
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
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
      <div className={`relative z-10 w-full max-w-md${reduced ? "" : " animate-[ams-pop_0.55s_cubic-bezier(.2,.9,.25,1.2)_both]"}`}>
        <div className="relative overflow-hidden rounded-2xl border border-gold bg-[oklch(0.13_0.025_250)]/95 px-6 pb-6 pt-20 text-center shadow-[0_30px_80px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_oklch(0.78_0.14_82/0.3)] sm:px-8 sm:pb-7">
          {/* Glint */}
          {!reduced && (
            <div className="pointer-events-none absolute inset-0" style={{
              background: "linear-gradient(115deg, transparent 35%, rgba(255,243,196,0.25) 50%, transparent 65%)",
              mixBlendMode: "screen",
              animation: "ams-glint 2.6s ease-in-out infinite",
            }} />
          )}

          <button
            ref={closeRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="Close"
            className="absolute right-2 top-2 z-10 grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5d77a]"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Award art */}
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <div className="relative grid h-32 w-32 place-items-center rounded-full" style={{ background: `radial-gradient(circle, ${ringColor}44, transparent 70%)` }}>
              <img src={payload.asset ?? meta.asset} alt="" className={`h-28 w-28 object-contain drop-shadow-[0_10px_30px_rgba(245,215,122,0.6)]${reduced ? "" : " animate-[ams-float_3s_ease-in-out_infinite]"}`} />
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.3em]" style={{ color: ringColor }}>
            <Icon className="h-3 w-3" /> {rarity} · {meta.title}
          </div>
          <h2 id={titleId} className="mt-2 font-display text-2xl font-semibold text-gold-gradient sm:text-3xl">{payload.title}</h2>
          {payload.subtitle && <p className="mt-2 text-sm text-muted-foreground">{payload.subtitle}</p>}

          {typeof payload.xp === "number" && payload.xp > 0 && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-gold bg-[oklch(0.18_0.03_250)] px-4 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-[#f5d77a]" />
              <span className="font-semibold text-[#f5d77a]">+<AnimatedNumber value={payload.xp} duration={900} /> XP</span>
            </div>
          )}

          {payload.extras && payload.extras.length > 0 && (
            <div className="mt-4 text-left">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Also earned</div>
              <ul className="mt-2 max-h-[28vh] space-y-1 overflow-y-auto pr-1 text-sm" data-recognition-extras>
                {payload.extras.map((x) => (
                  <li key={x} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5">
                    <Star className="h-3 w-3 shrink-0 text-[#f5d77a]" /> <span className="min-w-0">{x}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {payload.next && <p className="mt-4 text-xs text-muted-foreground">{payload.next}</p>}

          <div className="mt-6 flex items-center justify-center gap-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            <span>Tap anywhere to dismiss</span>
            {waiting > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSkipAll(); }}
                className="rounded-full border border-white/15 px-3 py-1 tracking-[0.15em] hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5d77a]"
              >
                Skip {waiting} more
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** A plain XP gain: noticed, not celebrated. */
function XpNotice({ payload, onClose }: { payload: CelebrationPayload; onClose: () => void }) {
  const reduced = useReducedMotion();
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    playCue(payload);
  }, [payload]);
  useEffect(() => {
    const t = setTimeout(onClose, 2800);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onClose}
        role="status"
        aria-live="polite"
        data-recognition-overlay="xp"
        className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-full border border-gold bg-[oklch(0.13_0.025_250)]/95 px-4 py-2 text-left shadow-lg${reduced ? "" : " animate-[ams-pop_0.4s_ease-out_both]"}`}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-[#f5d77a]" />
        <span className="text-sm font-semibold text-[#f5d77a]">
          +<AnimatedNumber value={payload.xp ?? 0} duration={reduced ? 0 : 700} /> XP
        </span>
        {payload.subtitle && <span className="min-w-0 truncate text-xs text-muted-foreground">{payload.subtitle}</span>}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// From a real recognition to a presentation
// ──────────────────────────────────────────────────────────────

/** The order a moment's recognitions are ranked in: the rarest leads. */
const TYPE_PRIORITY: Record<string, number> = {
  legacy: 100, stage: 80, trophy: 60, award: 55, certificate: 50,
  achievement: 45, badge: 35, passport: 32, milestone: 30, xp: 10,
};
const TIER_PRIORITY: Record<Recognition["tier"], number> = { legacy: 100, legendary: 90, standard: 0 };

function priorityOf(r: Recognition): number {
  return Math.max(TIER_PRIORITY[r.tier] ?? 0, TYPE_PRIORITY[r.type] ?? 20) + (r.priority ?? 0) / 100;
}

const RARITY: Record<string, Rarity> = {
  common: "Common", uncommon: "Common", rare: "Rare", epic: "Epic", elite: "Epic",
  legendary: "Legendary", mythic: "Mythic", founder: "Founder",
  bronze: "Common", silver: "Rare", gold: "Legendary", platinum: "Mythic",
};
const TROPHY_VOICE: Record<string, UnlockPreset> = {
  bronze: "bronze", silver: "silver", gold: "gold", platinum: "diamond",
};

const roleName = (role: string) => (role === "seo" ? "SEO" : role.charAt(0).toUpperCase() + role.slice(1));
const TYPE_LABEL: Record<string, string> = {
  stage: "Stage", legacy: "Legacy", achievement: "Achievement", milestone: "Milestone",
  badge: "Badge", trophy: "Trophy", award: "Award", certificate: "Certificate", passport: "Passport", xp: "XP",
};

function kindOf(r: Recognition): CelebrateKind {
  if (r.tier === "legacy") return "legacy";
  if (r.tier === "legendary") return "legendary";
  const k = r.type as CelebrateKind;
  return k in KIND_META ? k : "achievement";
}

function subtitleOf(r: Recognition): string {
  const parts = [roleName(r.role)];
  if (r.type === "stage" || r.type === "legacy") {
    if (r.stage) parts.push(`Stage ${r.stage} of 10`);
    if (r.rank) parts.push(`Rank ${r.rank}`);
    if (r.level && r.level !== r.rank) parts.push(`Level ${r.level}`);
  } else if (r.type === "xp") {
    if (r.description) parts.push(`for ${r.description.replace(/\./g, " ")}`);
  } else {
    parts.push(TYPE_LABEL[r.type] ?? r.type);
    if (r.stage) parts.push(`Stage ${r.stage}`);
  }
  return parts.join(" · ");
}

/** A moment's recognitions - one evaluation, one role - as one presentation. */
function presentationOf(group: Recognition[]): { payload: CelebrationPayload; priority: number } {
  const sorted = [...group].sort((a, b) => priorityOf(b) - priorityOf(a));
  const xp = group.filter((r) => r.type === "xp").reduce((s, r) => s + Number(r.xp || 0), 0);
  const head = sorted.find((r) => r.type !== "xp");

  if (!head) {
    const first = group[0];
    return {
      payload: {
        kind: "xp", title: `+${xp} XP`, xp,
        subtitle: `${roleName(first.role)}${first.description ? ` · for ${first.description.replace(/\./g, " ")}` : ""}`,
      },
      priority: TYPE_PRIORITY.xp,
    };
  }

  const kind = kindOf(head);
  const tierLabel = head.tier !== "standard" ? `${TYPE_LABEL[head.type] ?? head.type} · ` : "";
  const extras = sorted
    .filter((r) => r !== head && r.type !== "xp")
    .map((r) => `${TYPE_LABEL[r.type] ?? r.type} · ${r.name}`);
  const next = head.next
    ? `Next: Stage ${head.next.stage} · ${head.next.title} at ${Number(head.next.min_xp).toLocaleString()} XP`
    : undefined;

  return {
    payload: {
      kind,
      title: head.name,
      subtitle: tierLabel + subtitleOf(head),
      rarity: head.rarity ? RARITY[head.rarity] : undefined,
      xp: xp > 0 ? xp : undefined,
      unlock: head.type === "trophy" && head.tier === "standard" && head.rarity ? TROPHY_VOICE[head.rarity] : undefined,
      asset: recognitionArt(kind === "legendary" ? head.type : kind, head.role, head.stage),
      extras,
      next,
    },
    priority: priorityOf(head),
  };
}

// ──────────────────────────────────────────────────────────────
// Provider: one queue for the whole application
// ──────────────────────────────────────────────────────────────

type Queued = { seq: number; priority: number; payload: CelebrationPayload };

/** The pause between one presentation and the next. */
const COOLDOWN_MS = 700;

export function CelebrationProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [current, setCurrent] = useState<Queued | null>(null);
  const [soundOn, setSoundOnState] = useState(true);
  const seq = useRef(0);
  const seen = useRef(new Set<string>());
  const cooling = useRef(false);

  // The sound switch is the one persisted setting, not a second copy of it.
  useEffect(() => {
    setSoundOnState(getSoundPrefs().enabled);
    const unsub = subscribeSoundPrefs((p) => setSoundOnState(p.enabled));
    return () => { unsub(); };
  }, []);
  const setSoundOn = useCallback((b: boolean) => setSoundPrefs({ enabled: b }), []);

  const enqueue = useCallback((items: { priority: number; payload: CelebrationPayload }[]) => {
    if (items.length === 0) return;
    setQueue((q) => {
      const next = [...q, ...items.map((i) => ({ ...i, seq: ++seq.current }))];
      // Highest priority first; among equals, first come first served.
      next.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
      return next;
    });
  }, []);

  const celebrate = useCallback((p: CelebrationPayload) => {
    enqueue([{ priority: 0, payload: p }]);
  }, [enqueue]);

  const presentRecognitions = useCallback((items: Recognition[]) => {
    const fresh = items.filter((r) => r && r.ledger_id && !seen.current.has(r.ledger_id));
    fresh.forEach((r) => seen.current.add(r.ledger_id));
    if (fresh.length === 0) return;

    // Everything one evaluation granted for one role arrives stamped with the
    // same moment; that is one presentation, led by its rarest recognition.
    const groups = new Map<string, Recognition[]>();
    for (const r of fresh) {
      const key = `${r.role}|${r.created_at}`;
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    const presentations = [...groups.values()].map(presentationOf);

    if (!getSoundPrefs().celebrations) {
      // Celebrations are off: say it plainly, once per moment, without the show.
      for (const { payload } of presentations) {
        toast.success(payload.title, {
          description: [payload.subtitle, payload.extras?.length ? `Also: ${payload.extras.join(", ")}` : ""]
            .filter(Boolean).join(" · "),
        });
      }
      return;
    }
    enqueue(presentations);
  }, [enqueue]);

  // One presentation at a time, with a short pause between them.
  useEffect(() => {
    if (current || cooling.current || queue.length === 0) return;
    const [head, ...rest] = queue;
    setQueue(rest);
    setCurrent(head);
  }, [queue, current]);

  const close = useCallback(() => {
    setCurrent(null);
    cooling.current = true;
    setTimeout(() => {
      cooling.current = false;
      // Wake the queue after the pause.
      setQueue((q) => [...q]);
    }, COOLDOWN_MS);
  }, []);

  const skipAll = useCallback(() => {
    setQueue([]);
    close();
  }, [close]);

  const value = useMemo(() => ({ celebrate, presentRecognitions, soundOn, setSoundOn }), [celebrate, presentRecognitions, soundOn, setSoundOn]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {current && (current.payload.kind === "xp" && !current.payload.extras?.length
        ? <XpNotice key={current.seq} payload={current.payload} onClose={close} />
        : <Overlay key={current.seq} payload={current.payload} onClose={close} onSkipAll={skipAll} waiting={queue.length} />)}
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
        @keyframes ams-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </Ctx.Provider>
  );
}
