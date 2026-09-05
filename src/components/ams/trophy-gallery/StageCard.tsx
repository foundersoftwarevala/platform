import { useMemo, useRef, useState } from "react";
import { Sparkles, Volume2, Lock } from "lucide-react";
import { StageTrophy } from "./StageTrophy";
import { playUnlock } from "@/lib/ams/trophy-sounds";
import type { DeveloperStage } from "@/lib/ams/developer-stages";
import { useCelebration, type CelebrateKind } from "@/components/ams/effects/Celebration";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const UNLOCK_TO_KIND: Record<string, CelebrateKind> = {
  starter: "achievement",
  bronze: "achievement",
  silver: "levelUp",
  gold: "rankUp",
  elite: "rankUp",
  diamond: "milestone",
  legend: "trophy",
  master: "trophy",
  founder: "founder",
};

const KIND_ICON: Record<string, string> = {
  trophy: "🏆", medal: "🎖", badge: "🛡", passport: "📘", certificate: "📜",
  frame: "🖼", nameplate: "🪪", identity: "🆔", crown: "👑", collection: "🗄", museum: "🏛",
};

export function StageCard({ stage, unlocked = true }: { stage: DeveloperStage; unlocked?: boolean }) {
  const [celebrateOn, setCelebrateOn] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const { celebrate, soundOn } = useCelebration();

  const sparkleCount = reducedMotion ? 0 : 14;
  const sparkles = useMemo(
    () =>
      Array.from({ length: sparkleCount }).map((_, i) => ({
        id: i,
        left: `${10 + Math.random() * 80}%`,
        top: `${10 + Math.random() * 70}%`,
        delay: `${Math.random() * 2.4}s`,
        sx: `${(Math.random() - 0.5) * 40}px`,
        sy: `${-20 - Math.random() * 30}px`,
      })),
    [sparkleCount],
  );

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reducedMotion) return;
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: py * -8, y: px * 10 });
  }
  function onLeave() { setTilt({ x: 0, y: 0 }); }

  function unlock() {
    if (soundOn) {
      try { playUnlock(stage.unlock); } catch { /* noop */ }
    }
    setCelebrateOn(false);
    requestAnimationFrame(() => setCelebrateOn(true));
    setTimeout(() => setCelebrateOn(false), 2600);
    celebrate({
      kind: UNLOCK_TO_KIND[stage.unlock] ?? "achievement",
      title: `${stage.title} Unlocked`,
      subtitle: `${stage.material} · ${stage.theme}`,
      xp: 100 * stage.n,
    });
  }

  const [rFrom, rTo] = stage.ribbon;

  return (
    <div
      ref={cardRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative rounded-2xl border overflow-hidden group"
      style={{
        background: stage.bg.gradient,
        borderColor: `${stage.bg.accent}55`,
        boxShadow: `0 30px 60px -30px ${stage.bg.glow}, 0 0 0 1px ${stage.bg.accent}22 inset`,
      }}
    >
      {/* ambient sparkles */}
      <div className="pointer-events-none absolute inset-0">
        {sparkles.map((s) => (
          <span
            key={s.id}
            className="absolute h-1 w-1 rounded-full trophy-sparkle"
            style={{
              left: s.left, top: s.top,
              background: stage.bg.particle,
              boxShadow: `0 0 12px ${stage.bg.particle}`,
              animationDelay: s.delay,
              // @ts-expect-error CSS vars
              "--sx": s.sx, "--sy": s.sy,
            }}
          />
        ))}
      </div>

      {/* header */}
      <div className="relative z-10 flex items-start justify-between p-5">
        <div>
          <div className="text-[10px] font-mono tracking-[0.3em] uppercase" style={{ color: `${stage.bg.accent}` }}>
            {stage.code}
          </div>
          <div className="mt-1.5 text-xl font-semibold text-white">{stage.title}</div>
          <div className="text-[11px] uppercase tracking-widest" style={{ color: `${stage.bg.accent}bb` }}>
            {stage.theme} · {stage.material}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-1 rounded-full font-mono"
            style={{ background: `${stage.bg.accent}22`, color: stage.bg.accent, border: `1px solid ${stage.bg.accent}55` }}>
            LV {String(stage.n).padStart(2, "0")}
          </span>
          {!unlocked && <Lock className="h-4 w-4 text-white/40" />}
        </div>
      </div>

      {/* trophy stage */}
      <div className="relative z-10 h-64 flex items-center justify-center px-4">
        {/* presentation pedestal */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 h-6 w-56 rounded-full"
          style={{ background: `radial-gradient(closest-side, ${stage.bg.glow}, transparent)`, filter: "blur(6px)" }} />
        <div
          className="relative trophy-float"
          style={{
            transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            transition: "transform 200ms ease-out",
            filter: `drop-shadow(0 12px 24px ${stage.bg.glow})`,
          }}
        >
          <StageTrophy
            shape={stage.trophyShape}
            accent={stage.bg.accent}
            id={`stage-${stage.n}`}
            className={`h-56 w-56 ${celebrateOn ? "trophy-unlock" : ""}`}
          />
        </div>
      </div>

      {/* nameplate */}
      <div className="relative z-10 mx-5 mb-4 rounded-md border overflow-hidden"
        style={{
          borderColor: `${stage.bg.accent}66`,
          background: `linear-gradient(180deg, ${stage.bg.accent}22, transparent 60%, ${stage.bg.accent}18)`,
        }}>
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${rFrom}, ${rTo})` }} />
        <div className="px-4 py-2.5 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.24em] text-white/85">{stage.nameplate}</div>
          <Sparkles className="h-3.5 w-3.5" style={{ color: stage.bg.accent }} />
        </div>
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${rTo}, ${rFrom})` }} />
      </div>

      {/* tagline */}
      <div className="relative z-10 px-5 pb-3 text-sm text-white/70 italic">"{stage.tagline}"</div>

      {/* rewards grid */}
      <div className="relative z-10 px-5 pb-4">
        <div className="grid grid-cols-2 gap-1.5">
          {stage.rewards.map((r) => (
            <div key={r.label}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-white/85"
              style={{ background: `${stage.bg.accent}12`, border: `1px solid ${stage.bg.accent}33` }}>
              <span className="text-sm leading-none">{KIND_ICON[r.kind] ?? "•"}</span>
              <span className="truncate">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* animation + sound meta */}
      <div className="relative z-10 px-5 pb-4 grid grid-cols-2 gap-3 text-[10px]">
        <div>
          <div className="uppercase tracking-widest mb-1" style={{ color: `${stage.bg.accent}bb` }}>Animation</div>
          <div className="text-white/70 space-y-0.5">{stage.animation.map((a) => <div key={a}>· {a}</div>)}</div>
        </div>
        <div>
          <div className="uppercase tracking-widest mb-1" style={{ color: `${stage.bg.accent}bb` }}>Sound</div>
          <div className="text-white/70 space-y-0.5">{stage.sound.map((a) => <div key={a}>· {a}</div>)}</div>
        </div>
      </div>

      {/* actions */}
      <div className="relative z-10 border-t px-5 py-3 flex items-center justify-between"
        style={{ borderColor: `${stage.bg.accent}33`, background: "rgba(0,0,0,0.35)" }}>
        <div className="text-[11px] font-mono text-white/60">
          Passport · <span style={{ color: stage.bg.accent }}>{stage.passportMotif}</span>
        </div>
        <button
          onClick={unlock}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition hover:brightness-110"
          style={{
            background: `linear-gradient(135deg, ${stage.bg.accent}, ${rTo})`,
            color: "#1a1206",
            boxShadow: `0 0 22px -6px ${stage.bg.glow}`,
          }}
        >
          <Volume2 className="h-3.5 w-3.5" />
          Preview unlock
        </button>
      </div>
    </div>
  );
}
