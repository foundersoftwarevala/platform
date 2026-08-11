import { useEffect, useState } from "react";
import { ArrowRight, Play, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { RESELLER_BANNERS } from "@/lib/reseller-extras";

export function ResellerHero({ onAction }: { onAction?: (key: string) => void }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % RESELLER_BANNERS.length), 6500);
    return () => clearInterval(id);
  }, [paused]);

  const b = RESELLER_BANNERS[idx];
  const next = () => setIdx((i) => (i + 1) % RESELLER_BANNERS.length);
  const prev = () => setIdx((i) => (i - 1 + RESELLER_BANNERS.length) % RESELLER_BANNERS.length);

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="relative overflow-hidden rounded-3xl border border-border shadow-card"
      style={{ background: b.gradient, transition: "background 700ms ease" }}
    >
      <div
        className="absolute inset-0 opacity-50 pointer-events-none transition-opacity"
        style={{
          background:
            `radial-gradient(720px 260px at 80% 20%, color-mix(in oklab, ${b.accent} 35%, transparent), transparent),` +
            ` radial-gradient(520px 240px at 5% 100%, oklch(1 0 0 / 0.08), transparent)`,
        }}
      />
      <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay pointer-events-none"
           style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      <div className="relative grid md:grid-cols-[1.5fr_1fr] gap-6 p-6 md:p-10">
        <div key={idx} className="min-w-0 text-white animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em]">
            <Sparkles className="h-3 w-3" style={{ color: b.accent }} />
            {b.eyebrow}
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-[1.05]">
            {b.headline}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/75 max-w-xl">{b.sub}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onAction?.(b.cta)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-glow transition hover:opacity-95"
            >
              <Play className="h-4 w-4 fill-current" /> {b.cta}
            </button>
            <button
              type="button"
              onClick={() => onAction?.("ai-chat")}
              className="press-3d inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15 transition"
            >
              Learn more <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative hidden md:flex items-end justify-end gap-2">
          <div className="absolute -top-10 -right-10 h-72 w-72 rounded-full blur-3xl opacity-50"
               style={{ background: b.accent }} />
          <div className="relative flex items-center gap-1.5 z-10">
            <button type="button" onClick={prev} aria-label="Previous slide" className="press-3d grid h-9 w-9 place-items-center rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition text-white">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={next} aria-label="Next slide" className="press-3d grid h-9 w-9 place-items-center rounded-full bg-white/10 border border-white/15 hover:bg-white/20 transition text-white">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="relative px-6 md:px-10 pb-5 flex items-center gap-1.5 z-10">
        {RESELLER_BANNERS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Banner ${i + 1}`}
            className="h-1.5 rounded-full transition-all"
            style={{
              width: i === idx ? 28 : 10,
              background: i === idx ? "white" : "oklch(1 0 0 / 0.25)",
            }}
          />
        ))}
        <span className="ml-auto text-[10px] uppercase tracking-[0.18em] text-white/60">
          {idx + 1} / {RESELLER_BANNERS.length}
        </span>
      </div>
    </section>
  );
}
