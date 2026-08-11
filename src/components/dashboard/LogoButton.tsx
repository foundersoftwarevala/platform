import { useRef, useState } from "react";
import roundLogoAsset from "@/assets/dashboardLogoAsset";

type Reward =
  | "gold"      // Gold Particle Rain
  | "confetti"  // Confetti Burst
  | "spark"     // Spark Animation
  | "coins" | "stars" | "diamonds" | "crowns" | "sparkles" | "hearts" | "money";

const REWARDS: Reward[] = ["gold", "confetti", "spark", "coins", "stars", "diamonds", "crowns", "sparkles", "hearts", "money"];

const GLYPH: Record<Reward, string> = {
  gold: "🪙", confetti: "🎉", spark: "✨",
  coins: "🪙", stars: "★", diamonds: "💎", crowns: "👑",
  sparkles: "✦", hearts: "❤", money: "💵",
};

const COLORS: Record<Reward, string> = {
  gold: "oklch(0.85 0.18 85)",
  confetti: "oklch(0.78 0.2 350)",
  spark: "oklch(0.85 0.18 200)",
  coins: "oklch(0.85 0.18 85)",
  stars: "oklch(0.85 0.18 75)",
  diamonds: "oklch(0.85 0.16 200)",
  crowns: "oklch(0.85 0.18 60)",
  sparkles: "oklch(0.78 0.18 290)",
  hearts: "oklch(0.7 0.22 25)",
  money: "oklch(0.78 0.16 145)",
};

const ACHIEVEMENTS = [
  "Daily streak +1!",
  "Lucky click — bonus XP!",
  "Achievement unlocked!",
  "Combo +5",
  "Rare drop!",
  "Power up!",
];

type Particle = { id: number; x: number; y: number; r: number; s: number; g: string };
type Burst = { id: number; particles: Particle[]; reward: Reward; xp: number; label: string };

export function LogoButton({ size = 36 }: { size?: number }) {
  const [pulses, setPulses] = useState<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [popups, setPopups] = useState<{ id: number; xp: number; label: string; color: string }[]>([]);
  const id = useRef(0);
  const lastDaily = useRef<string | null>(null);

  function playSound(reward: Reward) {
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      // Achievement chime: two-note arpeggio
      const notes = reward === "gold" || reward === "confetti" ? [880, 1318.5, 1760] : [659.25, 987.77];
      notes.forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "triangle";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, now + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.12, now + i * 0.08 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.08 + 0.28);
        o.connect(g).connect(ctx.destination);
        o.start(now + i * 0.08);
        o.stop(now + i * 0.08 + 0.3);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch {
      /* sound is best-effort */
    }
  }

  function onClick() {
    const myId = ++id.current;
    setPulses((p) => [...p, myId]);
    setTimeout(() => setPulses((p) => p.filter((x) => x !== myId)), 900);

    // Daily reward check — once per day
    const today = new Date().toISOString().slice(0, 10);
    const isDaily = lastDaily.current !== today;
    lastDaily.current = today;

    const reward = isDaily ? "gold" : REWARDS[Math.floor(Math.random() * REWARDS.length)];
    const xp = isDaily ? 50 : 5 + Math.floor(Math.random() * 20);
    const label = isDaily ? "Daily Reward!" : ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)];

    playSound(reward);

    // Particle burst
    const count = reward === "gold" ? 28 : reward === "confetti" ? 26 : 16 + Math.floor(Math.random() * 8);
    const particles: Particle[] = Array.from({ length: count }, (_, i) => {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = reward === "gold" ? 80 + Math.random() * 80 : 60 + Math.random() * 60;
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - (reward === "gold" ? 50 : 30),
        r: (Math.random() - 0.5) * 360,
        s: 0.7 + Math.random() * 0.8,
        g: GLYPH[reward],
      };
    });
    setBursts((b) => [...b, { id: myId, particles, reward, xp, label }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== myId)), 1400);

    // XP popup
    setPopups((p) => [...p, { id: myId, xp, label, color: COLORS[reward] }]);
    setTimeout(() => setPopups((p) => p.filter((x) => x.id !== myId)), 1600);
  }

  return (
    <button
      onClick={onClick}
      type="button"
      className="logo-3d focus-ring shrink-0"
      style={{ width: size, height: size }}
      aria-label="Software Vala — click for a reward"
      title="Click me ✦"
    >
      <img
        src={roundLogoAsset.url}
        alt="Software Vala"
        className="h-full w-full rounded-full object-cover"
        draggable={false}
      />
      {/* Glow rings */}
      {pulses.map((p) => (
        <span
          key={p}
          className="pointer-events-none absolute inset-0 rounded-full animate-[svPulse_900ms_ease-out_forwards]"
        />
      ))}
      {/* Particle bursts */}
      {bursts.map((b) => (
        <span key={b.id} className="pointer-events-none absolute left-1/2 top-1/2 z-50">
          {b.particles.map((pt) => (
            <span
              key={pt.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 select-none text-base will-change-transform"
              style={{
                animation: "svBurst 1300ms cubic-bezier(0.18, 0.7, 0.25, 1) forwards",
                ["--tx" as any]: `${pt.x}px`,
                ["--ty" as any]: `${pt.y}px`,
                ["--r" as any]: `${pt.r}deg`,
                ["--s" as any]: pt.s,
              }}
            >
              {pt.g}
            </span>
          ))}
        </span>
      ))}
      {/* XP popups */}
      {popups.map((p) => (
        <span
          key={p.id}
          className="pointer-events-none absolute left-1/2 -top-2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold shadow-glow"
          style={{
            background: `linear-gradient(135deg, ${p.color}, oklch(0.55 0.22 290))`,
            color: "white",
            animation: "svXp 1500ms cubic-bezier(0.18, 0.7, 0.25, 1) forwards",
          }}
        >
          +{p.xp} XP · {p.label}
        </span>
      ))}
    </button>
  );
}
