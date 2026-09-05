import { useEffect, useMemo, useRef, useState } from "react";

const CLIPS = {
  idle: { webm: "/owl2/owl2-idle.webm", mp4: "/owl2/owl2-idle.mp4", loop: true, hold: 1, rate: 1 },
  greet: { webm: "/owl2/owl2-greet.webm", mp4: "/owl2/owl2-greet.mp4", loop: false, hold: 0.97, rate: 1.06 },
  curious: { webm: "/owl2/owl2-curious.webm", mp4: "/owl2/owl2-curious.mp4", loop: false, hold: 0.9, rate: 1.12 },
  hide: { webm: "/owl2/owl2-cover.webm", mp4: "/owl2/owl2-cover.mp4", loop: false, hold: 0.92, rate: 1.15 },
  celebrate: { webm: "/owl2/owl2-success.webm", mp4: "/owl2/owl2-success.mp4", loop: false, hold: 0.94, rate: 1.1 },
} as const;

export type OwlState = "idle" | "curious" | "hide" | "celebrate";
type ClipKey = OwlState | "greet";
const ORDER: ClipKey[] = ["idle", "greet", "curious", "hide", "celebrate"];
const PRIORITY: Record<ClipKey, number> = { idle: 0, greet: 1, curious: 2, hide: 3, celebrate: 4 };

export function OwlStage({ state = "idle" }: { state?: OwlState }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Partial<Record<ClipKey, HTMLVideoElement | null>>>({});
  const [ready, setReady] = useState<Partial<Record<ClipKey, boolean>>>({});
  const [active, setActive] = useState<ClipKey>("idle");
  const activeRef = useRef<ClipKey>("idle");
  const pending = useRef<OwlState>("idle");
  const greetDone = useRef(false);
  const lockUntil = useRef(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    pending.current = state;
    if (state !== "idle") greetDone.current = true;
    const resolve = () => {
      const now = performance.now();
      const want: ClipKey = greetDone.current ? pending.current : "greet";
      const current = activeRef.current;
      if (want === current) return;
      if (now < lockUntil.current && want !== "hide" && PRIORITY[want] <= PRIORITY[current]) return;
      const element = videoRefs.current[want];
      if (want !== "idle" && !ready[want] && (element?.readyState ?? 0) < 2) return;
      activeRef.current = want;
      setActive(want);
      const clip = CLIPS[want];
      if (element) {
        element.playbackRate = clip.rate;
        if (!clip.loop) element.currentTime = 0;
        void element.play().catch(() => undefined);
      }
      lockUntil.current = clip.loop ? 0 : now + (element?.duration ? element.duration * 0.6 * 1000 : 1600) / clip.rate;
      window.setTimeout(() => {
        for (const key of ORDER) {
          if (key !== activeRef.current && !CLIPS[key].loop) videoRefs.current[key]?.pause();
        }
      }, 520);
    };
    resolve();
    const interval = window.setInterval(resolve, 50);
    return () => window.clearInterval(interval);
  }, [ready, state]);

  const onProgress = (key: ClipKey) => (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const element = event.currentTarget;
    const clip = CLIPS[key];
    if (clip.loop || !element.duration || Number.isNaN(element.duration)) return;
    if (element.currentTime >= element.duration * clip.hold) {
      element.pause();
      element.currentTime = element.duration * clip.hold;
      if (key === "greet") greetDone.current = true;
    }
  };

  useEffect(() => {
    let raf = 0;
    let target = { x: 0, y: 0 };
    const aim = (clientX: number, clientY: number) => {
      const element = hostRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      target = {
        x: Math.max(-1, Math.min(1, (clientX - (rect.left + rect.width / 2)) / Math.max(window.innerWidth / 2, 1))),
        y: Math.max(-1, Math.min(1, (clientY - (rect.top + rect.height / 2)) / Math.max(window.innerHeight / 2, 1))),
      };
    };
    const onMove = (event: PointerEvent) => aim(event.clientX, event.clientY);
    const onTouch = (event: TouchEvent) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (touch) aim(touch.clientX, touch.clientY);
    };
    const onFocus = (event: FocusEvent) => {
      const element = event.target as HTMLElement | null;
      const rect = element?.getBoundingClientRect();
      if (rect?.width && rect.height) aim(rect.left + rect.width / 2, rect.top + rect.height / 2);
    };
    const tick = () => {
      setTilt((current) => ({ x: current.x + (target.x - current.x) * 0.075, y: current.y + (target.y - current.y) * 0.075 }));
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("touchstart", onTouch, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("focusin", onFocus);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("touchstart", onTouch);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("focusin", onFocus);
      cancelAnimationFrame(raf);
    };
  }, []);

  const stageStyle = useMemo(() => ({ transform: `translate3d(${tilt.x * 12}px, ${tilt.y * 7}px, 0) rotateY(${tilt.x * 4}deg) rotateX(${-tilt.y * 2.4}deg) scale(1.05)` }), [tilt]);

  return (
    <div ref={hostRef} className="relative size-full overflow-hidden [perspective:1200px]">
      <div className="absolute inset-0 will-change-transform" style={stageStyle}>
        {ORDER.map((key) => (
          <video
            key={key}
            ref={(element) => { videoRefs.current[key] = element; if (element) element.playbackRate = CLIPS[key].rate; }}
            autoPlay={CLIPS[key].loop}
            loop={CLIPS[key].loop}
            muted
            playsInline
            preload="auto"
            onCanPlayThrough={() => setReady((current) => (current[key] ? current : { ...current, [key]: true }))}
            onTimeUpdate={onProgress(key)}
            aria-hidden={key !== active}
            className="absolute inset-0 size-full object-cover transition-opacity duration-500 ease-out"
            style={{ opacity: key === active ? 1 : 0 }}
          >
            <source src={CLIPS[key].webm} type="video/webm" />
            <source src={CLIPS[key].mp4} type="video/mp4" />
          </video>
        ))}
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(72% 62% at 50% 42%, transparent 40%, rgba(15, 23, 42, 0.55) 82%, rgba(8, 12, 28, 0.9) 100%)" }} />
    </div>
  );
}