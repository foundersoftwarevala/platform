import { useRef, useState } from "react";
import roundLogoAsset from "@/assets/dashboardLogoAsset";
import { playSound } from "@/lib/ams/ui-sound";
import { prefersReducedMotion } from "@/hooks/use-reduced-motion";

/*
 * The logo's click flourish: a pulse and a burst of glyphs. It is decoration,
 * not recognition - it used to announce a random "+XP" and a made-up
 * achievement ("Lucky click - bonus XP!") that AMS never granted. XP and
 * achievements come only from the engine now, so the flourish claims nothing.
 */

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

type Particle = { id: number; x: number; y: number; r: number; s: number; g: string };
type Burst = { id: number; particles: Particle[]; reward: Reward };

export function LogoButton({ size = 36 }: { size?: number }) {
  const [pulses, setPulses] = useState<number[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const id = useRef(0);

  function onClick() {
    const myId = ++id.current;
    // One soft cue, under the same mute and volume as every other sound.
    playSound("toggle");
    if (prefersReducedMotion()) return;

    setPulses((p) => [...p, myId]);
    setTimeout(() => setPulses((p) => p.filter((x) => x !== myId)), 900);

    const reward = REWARDS[Math.floor(Math.random() * REWARDS.length)];

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
    setBursts((b) => [...b, { id: myId, particles, reward }]);
    setTimeout(() => setBursts((b) => b.filter((x) => x.id !== myId)), 1400);
  }

  return (
    <button
      onClick={onClick}
      type="button"
      className="logo-3d focus-ring shrink-0"
      style={{ width: size, height: size }}
      aria-label="Software Vala"
      title="Software Vala"
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
    </button>
  );
}
