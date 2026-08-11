import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { RoleConfig } from "@/lib/roles";

export type HeroSlide = {
  eyebrow: string;
  title: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  gradient: string;
  accent: string;
};

import { BookOpen, TrendingUp, Award, Users } from "lucide-react";

const AUTHOR_SLIDES: HeroSlide[] = [
  {
    eyebrow: "Author Studio",
    title: "Publish your next bestseller",
    sub: "Ship products, chapters and updates from one focused writing workspace.",
    icon: BookOpen,
    gradient: "linear-gradient(120deg, oklch(0.24 0.08 275), oklch(0.32 0.16 265), oklch(0.42 0.20 255))",
    accent: "oklch(0.78 0.18 285)",
  },
  {
    eyebrow: "Reader Growth",
    title: "Turn followers into loyal readers",
    sub: "Track engagement, followers and reviews across every launch in real time.",
    icon: Users,
    gradient: "linear-gradient(120deg, oklch(0.22 0.10 300), oklch(0.32 0.18 290), oklch(0.44 0.22 320))",
    accent: "oklch(0.80 0.18 320)",
  },
  {
    eyebrow: "Revenue Insights",
    title: "Grow royalties every month",
    sub: "Sales, refunds and payouts unified — know exactly what to write next.",
    icon: TrendingUp,
    gradient: "linear-gradient(120deg, oklch(0.24 0.10 200), oklch(0.32 0.16 210), oklch(0.44 0.22 230))",
    accent: "oklch(0.80 0.18 210)",
  },
  {
    eyebrow: "Achievements",
    title: "Level up your author journey",
    sub: "Unlock trophies, badges and certificates as your catalogue grows.",
    icon: Award,
    gradient: "linear-gradient(120deg, oklch(0.26 0.08 55), oklch(0.34 0.16 45), oklch(0.46 0.20 30))",
    accent: "oklch(0.82 0.18 60)",
  },
];

export function AuthorHero({ role, onCta }: { role: RoleConfig; onCta?: () => void }) {
  return <SlidingHero role={role} onCta={onCta} slides={AUTHOR_SLIDES} />;
}

export function SlidingHero({
  role,
  onCta,
  slides,
}: {
  role: RoleConfig;
  onCta?: () => void;
  slides: HeroSlide[];
}) {
  const SLIDES = slides;
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);

  function goTo(next: number) {
    setPrev(i);
    setI(((next % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setI((v) => {
        setPrev(v);
        return (v + 1) % SLIDES.length;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [paused]);

  const s = SLIDES[i];
  const Icon = s.icon;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border shadow-card"
      aria-roledescription="carousel"
      aria-label={`${role.name} highlights`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hero-stage relative flex min-h-[340px] md:min-h-[380px] bg-[oklch(0.18_0.04_265)]">
        {/* Cross-fading gradient layers for buttery slide transitions */}
        {SLIDES.map((sl, idx) => (
          <div
            key={idx}
            className="hero-slide"
            data-active={idx === i}
            data-leaving={idx === prev && idx !== i}
            aria-hidden="true"
          >
            <div className="absolute inset-0" style={{ background: sl.gradient }} />
            <div
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  `radial-gradient(760px 260px at 85% 12%, color-mix(in oklab, ${sl.accent} 48%, transparent), transparent),` +
                  ` radial-gradient(520px 260px at 4% 100%, oklch(1 0 0 / 0.10), transparent),` +
                  ` radial-gradient(360px 200px at 50% -10%, oklch(1 0 0 / 0.12), transparent)`,
              }}
            />
          </div>
        ))}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(90deg, oklch(0 0 0 / 0.42), oklch(0 0 0 / 0.12) 45%, oklch(0 0 0 / 0.30))" }}
        />
        <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

        <div
          key={i}
          className="hero-copy relative z-[1] flex-1 px-14 md:px-20 py-8 md:py-12 flex flex-col justify-center text-white"
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${SLIDES.length}: ${s.title}`}
          aria-live="polite"
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] w-fit">
            <Sparkles className="h-3 w-3" style={{ color: s.accent }} />
            {s.eyebrow}
          </div>
          <div className="mt-3 flex items-start gap-4 max-w-3xl">
            <div className="hidden md:grid h-12 w-12 place-items-center rounded-2xl bg-white/10 border border-white/15 shrink-0 shadow-[inset_0_1px_0_0_oklch(1_0_0/0.25),0_10px_24px_-12px_oklch(0_0_0/0.8)]">
              <Icon className="h-6 w-6" style={{ color: s.accent }} />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-[1.1] drop-shadow-[0_2px_10px_oklch(0_0_0/0.55)]">{s.title}</h2>
              <p className="mt-2 text-sm md:text-base text-white/75 max-w-xl">{s.sub}</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={onCta}
              className="press-3d sheen-3d focus-ring inline-flex items-center gap-2 rounded-xl bg-white text-black px-4 py-2 text-sm font-semibold hover:opacity-95"
            >
              {role.banner.cta}
            </button>
            <span className="text-[11px] text-white/60 uppercase tracking-wider">
              {i + 1} / {SLIDES.length}
            </span>
          </div>
        </div>

        {/* Controls */}
        <button
          type="button"
          aria-label="Previous slide"
          onClick={() => goTo(i - 1)}
          className="focus-ring absolute z-[2] left-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur transition-colors shadow-[0_6px_16px_-8px_oklch(0_0_0/0.8)]"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Next slide"
          onClick={() => goTo(i + 1)}
          className="focus-ring absolute z-[2] right-3 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/40 hover:bg-black/60 border border-white/20 text-white backdrop-blur transition-colors shadow-[0_6px_16px_-8px_oklch(0_0_0/0.8)]"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Dots */}
        <div className="absolute z-[2] bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5" role="tablist" aria-label="Choose slide">
          {SLIDES.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === i}
              aria-label={`Go to slide ${idx + 1}`}
              onClick={() => goTo(idx)}
              className={
                "focus-ring h-1.5 rounded-full transition-all " +
                (idx === i ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70")
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}