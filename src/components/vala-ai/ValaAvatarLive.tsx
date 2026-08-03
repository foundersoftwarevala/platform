import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import valaAgent from "@/assets/vala-ai-agent.png";

export type ValaState = "idle" | "listening" | "thinking" | "speaking" | "welcome";

/**
 * LIVING VALA AVATAR
 * A layered, GPU-accelerated composite: portrait + animated SVG energy circuits,
 * rotating chest AI core, blink/eye-tracking overlays, holographic particles and
 * a voice waveform. Every layer animates via transform/opacity only (60fps).
 */

type CircuitPath = { d: string; dur: number; delay: number; width: number; opacity: number };

// Circuit network mapped over the character silhouette (viewBox 0 0 100 150).
const CIRCUITS: CircuitPath[] = [
  // face / cheek lines
  { d: "M46 24 C43 27, 42 31, 44 35", dur: 2.6, delay: 0, width: 0.7, opacity: 0.95 },
  { d: "M55 24 C58 27, 59 31, 57 35", dur: 3.1, delay: 0.4, width: 0.7, opacity: 0.85 },
  { d: "M44 20 C48 18, 53 18, 57 20", dur: 3.6, delay: 0.9, width: 0.6, opacity: 0.7 },
  // neck to core
  { d: "M48 38 L48 46 L50 50", dur: 2.2, delay: 0.2, width: 0.9, opacity: 1 },
  { d: "M54 38 L54 46 L52 50", dur: 2.4, delay: 0.6, width: 0.9, opacity: 1 },
  // shoulders
  { d: "M50 52 C42 52, 36 56, 33 64", dur: 3, delay: 0.1, width: 1, opacity: 0.95 },
  { d: "M52 52 C60 52, 66 56, 69 64", dur: 3.2, delay: 0.5, width: 1, opacity: 0.95 },
  // arms
  { d: "M33 64 C30 76, 30 88, 33 100", dur: 4, delay: 0.3, width: 0.8, opacity: 0.8 },
  { d: "M69 64 C72 76, 72 88, 69 100", dur: 4.2, delay: 0.8, width: 0.8, opacity: 0.8 },
  // torso ribs
  { d: "M44 60 C40 68, 40 76, 44 84", dur: 3.4, delay: 0.15, width: 0.7, opacity: 0.85 },
  { d: "M58 60 C62 68, 62 76, 58 84", dur: 3.7, delay: 0.55, width: 0.7, opacity: 0.85 },
  { d: "M46 88 L51 92 L56 88", dur: 2.8, delay: 1, width: 0.6, opacity: 0.7 },
  // legs
  { d: "M47 96 C45 110, 45 124, 46 138", dur: 4.6, delay: 0.2, width: 0.7, opacity: 0.75 },
  { d: "M55 96 C57 110, 57 124, 56 138", dur: 4.9, delay: 0.7, width: 0.7, opacity: 0.75 },
];

const PARTICLES = Array.from({ length: 12 }, (_, i) => ({
  left: 18 + ((i * 37) % 66),
  delay: (i * 0.83) % 6,
  dur: 5 + ((i * 1.7) % 4),
  size: 1.5 + ((i * 0.7) % 2),
}));

/**
 * HUMAN BEHAVIOUR ENGINE
 * Real people are never perfectly periodic: they blink irregularly (sometimes twice),
 * their eyes dart in micro-saccades, they glance away while thinking, shift weight,
 * nod while listening and move their jaw unevenly while talking.
 * This hook produces that noise on a single rAF loop.
 */
type Behaviour = {
  blink: number; // 0 open → 1 closed
  saccade: { x: number; y: number }; // small involuntary eye darts
  glance: { x: number; y: number }; // occasional look-away
  head: { yaw: number; pitch: number; roll: number };
  jaw: number; // 0..1 mouth openness while speaking
  brow: number; // -1 concerned .. 1 raised/happy
  breath: number; // 0..1
};

function useHumanBehaviour(state: ValaState): Behaviour {
  const [b, setB] = useState<Behaviour>({
    blink: 0,
    saccade: { x: 0, y: 0 },
    glance: { x: 0, y: 0 },
    head: { yaw: 0, pitch: 0, roll: 0 },
    jaw: 0,
    brow: 0,
    breath: 0,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let raf = 0;
    let nextBlink = performance.now() + 1200;
    let blinkStart = -1;
    let doubleBlink = false;
    let nextSaccade = performance.now() + 900;
    let sac = { x: 0, y: 0 };
    let nextGlance = performance.now() + 7000;
    let glanceUntil = 0;
    let glance = { x: 0, y: 0 };
    let jawSeed = Math.random() * 100;

    const rand = (a: number, c: number) => a + Math.random() * (c - a);

    const loop = (now: number) => {
      const s = stateRef.current;
      const t = now / 1000;

      /* --- blinking: irregular, sometimes a quick double blink --- */
      if (blinkStart < 0 && now >= nextBlink) {
        blinkStart = now;
        doubleBlink = Math.random() < 0.22;
      }
      let blink = 0;
      if (blinkStart >= 0) {
        const e = now - blinkStart;
        const span = doubleBlink ? 430 : 190;
        if (e >= span) {
          blinkStart = -1;
          // people blink faster when talking / thinking, slower when calm
          const base = s === "speaking" ? 2400 : s === "thinking" ? 2000 : 3600;
          nextBlink = now + rand(base * 0.55, base * 1.7);
        } else if (doubleBlink) {
          const p = e < 170 ? e / 170 : e < 250 ? 1 - (e - 170) / 80 : (e - 250) / 180;
          blink = Math.sin(Math.min(1, Math.max(0, p)) * Math.PI);
        } else {
          blink = Math.sin((e / span) * Math.PI);
        }
      }

      /* --- micro-saccades: tiny involuntary eye jumps --- */
      if (now >= nextSaccade) {
        sac = { x: rand(-1, 1), y: rand(-0.6, 0.6) };
        nextSaccade = now + rand(s === "thinking" ? 500 : 900, s === "thinking" ? 1400 : 2600);
      }

      /* --- glance away (thinking / recalling), then back to the user --- */
      if (now >= nextGlance && glanceUntil < now) {
        // thinkers look up-left, idle people drift sideways
        glance =
          s === "thinking"
            ? { x: rand(-1, -0.4), y: -0.9 }
            : { x: rand(-1, 1), y: rand(-0.3, 0.4) };
        glanceUntil = now + rand(700, 1600);
        nextGlance = glanceUntil + rand(4000, 11000);
      }
      const glancing = now < glanceUntil;

      /* --- breathing + posture weight shift --- */
      const breath = (Math.sin(t * (s === "idle" ? 0.62 : 0.9)) + 1) / 2;
      const drift = Math.sin(t * 0.23) * 0.6 + Math.sin(t * 0.11 + 1.7) * 0.4;

      /* --- head: listening nods, thinking tilt, speaking emphasis --- */
      let yaw = drift * 2 + (glancing ? glance.x * 5 : 0);
      let pitch = Math.sin(t * 0.31) * 0.8 + (glancing ? glance.y * 3 : 0);
      let roll = Math.sin(t * 0.19) * 0.9;
      if (s === "listening") pitch += Math.sin(t * 1.9) * 1.6; // gentle nodding
      if (s === "thinking") roll += 3.2; // head tilt
      if (s === "speaking") {
        yaw += Math.sin(t * 1.35) * 1.8;
        pitch += Math.sin(t * 2.1) * 1.2;
      }

      /* --- jaw / lip movement: uneven, syllable-like --- */
      let jaw = 0;
      if (s === "speaking") {
        const a = Math.sin((t + jawSeed) * 11.3);
        const c = Math.sin((t + jawSeed) * 6.7 + 1.1);
        jaw = Math.max(0, a * 0.6 + c * 0.4) * (0.55 + 0.45 * ((Math.sin(t * 0.8) + 1) / 2));
      }

      /* --- brow expression --- */
      const brow =
        s === "speaking" ? 0.5 + Math.sin(t * 1.7) * 0.3
        : s === "listening" ? 0.7
        : s === "thinking" ? -0.6
        : s === "welcome" ? 1
        : Math.sin(t * 0.4) * 0.2;

      setB({
        blink,
        saccade: sac,
        glance: glancing ? glance : { x: 0, y: 0 },
        head: { yaw, pitch, roll },
        jaw,
        brow,
        breath,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return b;
}

export function ValaAvatarLive({
  state = "idle",
  className,
  showWaveform = true,
}: {
  state?: ValaState;
  className?: string;
  showWaveform?: boolean;
}) {
  const [entered, setEntered] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });
  const [reaction, setReaction] = useState<"none" | "greet" | "acknowledge">("none");
  const ref = useRef<HTMLDivElement>(null);
  const human = useHumanBehaviour(state);

  // Smooth welcome entrance: fade in + circuits boot from the chest outward.
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Eye / head tracking towards the pointer.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.22;
      setGaze({
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth / 2))),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight / 2))),
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Human-style reactions: greets on arrival, acknowledges when you interact.
  useEffect(() => {
    if (state === "welcome" || state === "listening") {
      setReaction(state === "welcome" ? "greet" : "acknowledge");
      const t = setTimeout(() => setReaction("none"), 1600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state]);


  const active = state === "speaking" || state === "listening" || state === "thinking";
  const flowScale = state === "speaking" ? 0.45 : state === "listening" ? 0.6 : state === "thinking" ? 0.7 : 1;
  const bars = useMemo(() => [0.35, 0.7, 1, 0.55, 0.85, 0.45, 0.75, 0.3], []);

  return (
    <div
      ref={ref}
      data-state={state}
      className={cn(
        "relative isolate select-none [transform:translateZ(0)] [will-change:transform]",
        "transition-[opacity,transform] duration-[1200ms] ease-out",
        entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className,
      )}
    >
      {/* Ambient bloom */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[95%] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-700",
          state === "listening" && "bg-accent/55",
          state === "thinking" && "bg-primary/55",
          state === "speaking" && "bg-primary-glow/60",
          (state === "idle" || state === "welcome") && "bg-primary/35",
        )}
        style={{ animation: `vala-bloom ${active ? 1.8 : 4.5}s ease-in-out infinite` }}
      />

      {/* Character — human posture: breathing, weight shift, head turn, nods */}
      <div
        className="relative h-full w-full [transform-style:preserve-3d] [will-change:transform]"
        style={{
          transform: [
            "perspective(760px)",
            `rotateY(${gaze.x * 4 + human.head.yaw}deg)`,
            `rotateX(${-gaze.y * 2.5 + human.head.pitch}deg)`,
            `rotateZ(${human.head.roll}deg)`,
            `translateY(${(-human.breath * 0.5 - (reaction === "greet" ? 0.6 : 0)).toFixed(2)}%)`,
            `scaleY(${(1 + human.breath * 0.006).toFixed(4)})`,
          ].join(" "),
        }}
      >
        <img
          src={valaAgent}
          alt="Vala AI executive assistant, a futuristic female android with glowing blue energy circuits"
          width={832}
          height={1216}
          className="h-full w-auto object-contain drop-shadow-[0_22px_60px_rgba(45,150,255,0.6)]"
        />

        {/* Eyelids — irregular human blinking (incl. occasional double blink) */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[42%] top-[13.2%] w-[16%] rounded-full bg-[rgba(8,16,34,0.72)] blur-[1.2px]"
          style={{
            height: `${(0.35 + human.blink * 2.2).toFixed(2)}%`,
            opacity: 0.35 + human.blink * 0.65,
          }}
        />

        {/* Pupil light — pointer tracking + micro-saccades + look-away glances */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[42%] top-[13%] h-[2.4%] w-[16%] rounded-full bg-[radial-gradient(circle,rgba(120,220,255,0.75),transparent_70%)] blur-[2px]"
          style={{
            transform: `translate(${(gaze.x * 12 + human.saccade.x * 4 + human.glance.x * 14).toFixed(2)}%, ${(gaze.y * 8 + human.saccade.y * 3 + human.glance.y * 8).toFixed(2)}%)`,
            transition: "transform 180ms cubic-bezier(.22,1,.36,1)",
            opacity: (state === "listening" ? 1 : 0.55) * (1 - human.blink),
          }}
        />

        {/* Brow expression — raised when happy/listening, drawn in when thinking */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[41%] top-[11.4%] h-[0.9%] w-[18%] rounded-full bg-[radial-gradient(circle,rgba(140,220,255,0.35),transparent_75%)]"
          style={{
            transform: `translateY(${(-human.brow * 0.6).toFixed(2)}%) scaleX(${(1 + human.brow * 0.04).toFixed(3)})`,
            opacity: 0.25 + Math.abs(human.brow) * 0.35,
            transition: "opacity 400ms ease-out",
          }}
        />

        {/* Jaw / lips — uneven syllable-like movement while speaking */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[45.5%] top-[17.4%] w-[9%] rounded-[50%] bg-[radial-gradient(ellipse,rgba(20,40,70,0.55),transparent_75%)] blur-[1px]"
          style={{
            height: `${(0.3 + human.jaw * 1.9).toFixed(2)}%`,
            opacity: state === "speaking" ? 0.55 + human.jaw * 0.45 : 0,
            transition: "opacity 220ms ease-out",
          }}
        />

        {/* Smile / warmth flash on greeting or acknowledgement */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-[44%] top-[18.2%] h-[1.6%] w-[12%] rounded-b-full border-b-2 border-[rgba(150,225,255,0.55)] blur-[1px] transition-opacity duration-500"
          style={{ opacity: reaction === "none" ? 0 : 0.8 }}
        />


        {/* Energy circuit network */}
        <svg
          aria-hidden
          viewBox="0 0 100 150"
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            <filter id="vala-bloom-filter" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="1.1" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="vala-line" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.92 0.13 205)" />
              <stop offset="100%" stopColor="oklch(0.68 0.19 250)" />
            </linearGradient>
          </defs>

          <g filter="url(#vala-bloom-filter)">
            {CIRCUITS.map((c, i) => (
              <g key={i}>
                {/* base trace, softly breathing */}
                <path
                  d={c.d}
                  fill="none"
                  stroke="url(#vala-line)"
                  strokeWidth={c.width}
                  strokeLinecap="round"
                  opacity={c.opacity * (active ? 0.75 : 0.5)}
                  style={{
                    animation: `vala-trace ${3 + (i % 4)}s ease-in-out ${c.delay}s infinite`,
                    // circuits boot up one by one from the chest on welcome
                    animationDelay: `${entered ? c.delay : i * 0.12}s`,
                  }}
                />
                {/* travelling energy pulse */}
                <path
                  d={c.d}
                  fill="none"
                  stroke="oklch(0.96 0.12 200)"
                  strokeWidth={c.width * 1.25}
                  strokeLinecap="round"
                  pathLength={100}
                  strokeDasharray="14 86"
                  style={{
                    animation: `vala-pulse ${(c.dur * flowScale).toFixed(2)}s linear ${c.delay}s infinite`,
                    filter: "drop-shadow(0 0 2px oklch(0.9 0.14 210))",
                  }}
                />
              </g>
            ))}
          </g>

          {/* Chest AI core */}
          <g transform="translate(51 57)">
            <circle
              r="5.6"
              fill="none"
              stroke="oklch(0.9 0.13 205)"
              strokeWidth="0.6"
              strokeDasharray="4 3"
              opacity="0.85"
              style={{ animation: `vala-spin ${state === "speaking" ? 3 : 7}s linear infinite` }}
            />
            <circle
              r="3.6"
              fill="none"
              stroke="oklch(0.82 0.15 235)"
              strokeWidth="0.5"
              strokeDasharray="2 4"
              opacity="0.9"
              style={{ animation: `vala-spin-rev ${state === "speaking" ? 2.2 : 5}s linear infinite` }}
            />
            <circle
              r="2"
              fill="oklch(0.93 0.12 205)"
              style={{
                animation: `vala-core ${state === "speaking" ? 0.8 : state === "thinking" ? 1.2 : 2.6}s ease-in-out infinite`,
                filter: "drop-shadow(0 0 3px oklch(0.9 0.15 210))",
              }}
            />
            {/* energy release ring every few seconds */}
            <circle
              r="2"
              fill="none"
              stroke="oklch(0.9 0.13 205)"
              strokeWidth="0.5"
              style={{ animation: `vala-ring ${state === "speaking" ? 1.6 : 3.6}s ease-out infinite` }}
            />
          </g>
        </svg>

        {/* Holographic particles */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARTICLES.map((p, i) => (
            <span
              key={i}
              className="absolute bottom-0 rounded-full bg-accent/70"
              style={{
                left: `${p.left}%`,
                height: p.size,
                width: p.size,
                animation: `vala-particle ${p.dur}s linear ${p.delay}s infinite`,
                filter: "drop-shadow(0 0 3px oklch(0.9 0.14 210))",
              }}
            />
          ))}
        </div>
      </div>

      {/* Voice waveform */}
      {showWaveform && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-1 flex items-end justify-center gap-[3px] transition-opacity duration-300",
            state === "speaking" || state === "listening" ? "opacity-100" : "opacity-0",
          )}
        >
          {bars.map((b, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-gradient-to-t from-primary to-accent"
              style={{
                height: `${8 + b * 14}px`,
                animation: `vala-wave ${0.5 + b * 0.4}s ease-in-out ${i * 0.06}s infinite`,
                transformOrigin: "bottom",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ValaAvatarLive;
