import { useEffect, useRef, useState } from "react";
import { Download, RotateCw, Pause, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useCelebration, type CelebrateKind } from "@/components/ams/effects/Celebration";
import { MuseumCase, SVMicroMark, SVSeal, svCollectionNumber } from "@/components/ams/brand/SVMark";

/**
 * Ultra-premium 3D collectible viewer with:
 *  - Lazy mount via IntersectionObserver (heavy visuals only when visible)
 *  - Reduced-motion mode (auto from prefers-reduced-motion + local override)
 *  - CSS 3D rotation, animated rim/spot lighting, sparkles, floor reflection
 *  - Download PNG button
 *  - Optional Unlock button that fires the app-wide Celebration overlay
 */
export function Collectible3D({
  src,
  filename,
  accent,
  label,
  height = 320,
  unlockKind = "trophy",
  unlockTitle,
  unlockSubtitle,
  showUnlock = false,
  eager = false,
}: {
  src: string;
  filename: string;
  accent: string;
  label?: string;
  height?: number;
  unlockKind?: CelebrateKind;
  unlockTitle?: string;
  unlockSubtitle?: string;
  showUnlock?: boolean;
  /** Skip the IntersectionObserver gate and mount immediately. */
  eager?: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const { celebrate } = useCelebration();

  const [spin, setSpin] = useState(!reducedMotion);
  const [inView, setInView] = useState(eager);
  const [visible, setVisible] = useState(eager);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setSpin(!reducedMotion), [reducedMotion]);

  // IntersectionObserver lazy mount + pause when off-screen for perf.
  useEffect(() => {
    if (eager) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true); setVisible(true); return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            setVisible(true);
          } else {
            setVisible(false);
          }
        }
      },
      { rootMargin: "200px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  async function handleDownload() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank");
    }
  }

  function handleUnlock() {
    celebrate({
      kind: unlockKind,
      title: unlockTitle ?? label ?? "Collectible Unlocked",
      subtitle: unlockSubtitle,
    });
  }

  const animate = !reducedMotion && visible;
  const doSpin = spin && animate;

  return (
    <div
      ref={wrapRef}
      className="relative w-full rounded-2xl overflow-hidden border"
      style={{
        height,
        perspective: "1200px",
        borderColor: `${accent}55`,
        background: `
          radial-gradient(120% 60% at 50% 0%, ${accent}22, transparent 60%),
          radial-gradient(80% 50% at 50% 100%, ${accent}18, transparent 70%),
          linear-gradient(180deg, #05070d 0%, #0a0f1a 55%, #050810 100%)
        `,
        boxShadow: `inset 0 0 60px ${accent}22, 0 30px 60px -30px ${accent}66`,
        contain: "content",
      }}
    >
      {!inView ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 rounded-full animate-pulse"
            style={{ background: `radial-gradient(closest-side, ${accent}44, transparent)` }} />
        </div>
      ) : (
        <>
          {animate && (
            <div
              className="pointer-events-none absolute inset-0 opacity-70 collectible-rim"
              style={{
                background: `conic-gradient(from 0deg, transparent, ${accent}55, transparent 30%, ${accent}33, transparent 60%, ${accent}66, transparent)`,
                mixBlendMode: "screen",
                filter: "blur(30px)",
              }}
            />
          )}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-2/3"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, ${accent}44, transparent 60%)`,
              mixBlendMode: "screen",
            }}
          />
          {animate && (
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute block h-1 w-1 rounded-full trophy-sparkle"
                  style={{
                    left: `${(i * 97) % 100}%`,
                    top: `${20 + ((i * 53) % 60)}%`,
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                    animationDelay: `${(i % 5) * 0.4}s`,
                    // @ts-expect-error CSS custom props
                    "--sx": `${((i * 13) % 40) - 20}px`,
                    "--sy": `${-20 - (i % 8) * 4}px`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative h-full w-full flex items-center justify-center">
            <div
              className="relative"
              style={{
                transformStyle: "preserve-3d",
                animation: doSpin ? "collectible-spin 12s linear infinite" : "none",
                width: height * 0.7,
                height: height * 0.9,
                willChange: doSpin ? "transform" : undefined,
              }}
            >
              <img
                src={src}
                alt={label ?? filename}
                loading="lazy"
                decoding="async"
                width={1024}
                height={1024}
                className="h-full w-full object-contain"
                style={{
                  filter: `drop-shadow(0 20px 40px ${accent}aa) drop-shadow(0 0 20px ${accent}66)`,
                  backfaceVisibility: "hidden",
                }}
              />
              {animate && (
                <div
                  className="pointer-events-none absolute inset-0 trophy-shine"
                  style={{
                    background: `linear-gradient(115deg, transparent 40%, ${accent}66 50%, transparent 60%)`,
                    mixBlendMode: "screen",
                  }}
                />
              )}
            </div>

            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6 h-6 rounded-full"
              style={{
                width: height * 0.55,
                background: `radial-gradient(closest-side, ${accent}bb, transparent 70%)`,
                filter: "blur(10px)",
              }}
            />
          </div>
        </>
      )}

      {/* Software Vala museum case + brand marks */}
      <MuseumCase accent={accent} />
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <SVSeal accent={accent} />
        <SVMicroMark accent={accent} className="hidden sm:inline" />
      </div>
      <div
        className="absolute bottom-2 right-3 z-10 font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: "0.22em", color: `${accent}aa` }}
      >
        {svCollectionNumber(filename, "sv")}
      </div>

      {/* Controls */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setSpin((s) => !s)}
            title={spin ? "Pause rotation" : "Resume rotation"}
            className="h-8 w-8 rounded-md border flex items-center justify-center text-white/90 backdrop-blur bg-black/40 hover:bg-black/60 transition"
            style={{ borderColor: `${accent}66` }}
          >
            {spin ? <Pause className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={handleDownload}
          title="Download PNG"
          className="h-8 rounded-md border flex items-center gap-1.5 px-2.5 text-[11px] font-medium text-white/90 backdrop-blur bg-black/40 hover:bg-black/60 transition"
          style={{ borderColor: `${accent}66` }}
        >
          <Download className="h-3.5 w-3.5" />
          PNG
        </button>
      </div>

      {showUnlock && (
        <button
          type="button"
          onClick={handleUnlock}
          className="absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
            color: "#0b0f1a",
            boxShadow: `0 0 22px -6px ${accent}`,
          }}
        >
          <Sparkles className="h-3.5 w-3.5" /> Unlock
        </button>
      )}

      {label && (
        <div
          className="absolute bottom-2 left-3 text-[10px] font-mono tracking-[0.3em] uppercase"
          style={{ color: `${accent}cc` }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
