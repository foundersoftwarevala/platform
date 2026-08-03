/**
 * SLIDER BANNER — plain (no image) 3D poster-style auto slider.
 * Feeds from bannerFeed store: alerts / notifications / approvals / to-dos.
 * Every button is functional.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ListTodo,
  Pause,
  Play,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  completeBannerItem,
  resolveBannerItem,
  useBannerFeed,
  type BannerKind,
} from "./bannerFeed";

const KIND_STYLE: Record<
  BannerKind,
  { label: string; icon: typeof Bell; hues: string[]; glows: string[]; chip: string }
> = {
  alert: {
    label: "Alert",
    icon: AlertTriangle,
    hues: [
      "linear-gradient(135deg,#ff8f8f 0%,#ff5470 48%,#ff2d55 100%)",
      "linear-gradient(135deg,#ffb0a0 0%,#ff6b6b 50%,#e8305a 100%)",
      "linear-gradient(135deg,#ff9db6 0%,#ff4d6d 52%,#d92e4e 100%)",
    ],
    glows: ["rgba(255,99,120,0.85)", "rgba(255,140,120,0.85)", "rgba(255,110,150,0.85)"],
    chip: "bg-white/25 text-white border-white/50",
  },
  approval: {
    label: "Approval",
    icon: ClipboardCheck,
    hues: [
      "linear-gradient(135deg,#8fd7ff 0%,#4facfe 48%,#2f7dff 100%)",
      "linear-gradient(135deg,#a5e4ff 0%,#58c7ff 50%,#3a8dff 100%)",
      "linear-gradient(135deg,#9be7f5 0%,#49b8ff 52%,#2f95ff 100%)",
    ],
    glows: ["rgba(120,200,255,0.85)", "rgba(110,190,255,0.85)", "rgba(140,220,255,0.85)"],
    chip: "bg-white/25 text-white border-white/50",
  },
  notification: {
    label: "Notification",
    icon: Bell,
    hues: [
      "linear-gradient(135deg,#c0b3ff 0%,#8f7bff 48%,#6a5bff 100%)",
      "linear-gradient(135deg,#b7c6ff 0%,#7f9bff 50%,#5d7bff 100%)",
      "linear-gradient(135deg,#d5b8ff 0%,#a184ff 52%,#7b62ff 100%)",
    ],
    glows: ["rgba(170,160,255,0.85)", "rgba(150,175,255,0.85)", "rgba(190,150,255,0.85)"],
    chip: "bg-white/25 text-white border-white/50",
  },
  todo: {
    label: "To-Do",
    icon: ListTodo,
    hues: [
      "linear-gradient(135deg,#9ff5d8 0%,#43e0b7 48%,#16c79a 100%)",
      "linear-gradient(135deg,#aef2e9 0%,#4dd8d0 50%,#19b3b8 100%)",
      "linear-gradient(135deg,#c6f7b0 0%,#68e08e 52%,#22c281 100%)",
    ],
    glows: ["rgba(110,240,205,0.85)", "rgba(110,230,225,0.85)", "rgba(150,240,170,0.85)"],
    chip: "bg-white/25 text-white border-white/50",
  },
};


interface SliderBannerProps {
  className?: string;
  intervalMs?: number;
  compact?: boolean;
}

export function SliderBanner({ className, intervalMs = 5000, compact = false }: SliderBannerProps) {
  const items = useBannerFeed();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);

  const count = items.length;
  const safeIndex = count ? index % count : 0;
  const item = items[safeIndex];

  useEffect(() => {
    if (!playing || count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(t);
  }, [playing, count, intervalMs]);

  const go = useCallback(
    (dir: number) => setIndex((i) => (count ? (i + dir + count) % count : 0)),
    [count],
  );

  const style = useMemo(() => KIND_STYLE[item?.kind ?? "notification"], [item?.kind]);
  const variant = safeIndex % 3;
  const hue = style.hues[variant % style.hues.length];
  const glow = style.glows[variant % style.glows.length];


  if (!item) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-3xl border-2 border-primary/40 p-8 text-sm font-semibold text-foreground/70",
          className,
        )}
        style={{ background: "linear-gradient(160deg,#10254a,#060d1d)" }}
      >
        All clear, Boss — koi pending alert, approval ya to-do nahi hai.
      </div>
    );
  }

  const Icon = style.icon;
  const primaryLabel =
    item.primaryLabel ??
    (item.kind === "approval" ? "Approve" : item.kind === "todo" ? "Mark Done" : "Acknowledge");

  return (
    <section
      className={cn("relative select-none [perspective:1400px]", className)}
      aria-roledescription="carousel"
      onMouseEnter={() => setPlaying(false)}
      onMouseLeave={() => setPlaying(true)}
    >
      {/* glow base layer (3D poster depth) */}
      <div
        className="absolute inset-x-6 -bottom-3 h-16 rounded-[2rem] blur-2xl transition-all duration-700"
        style={{
          background: glow,
          opacity: "calc(0.9 * var(--banner-glow-density, 0.9))",
        }}
        aria-hidden
      />

      <div
        key={item.id}
        className={cn(
          "relative overflow-hidden rounded-3xl border-2 border-white/40 animate-fade-in",
          "shadow-[0_36px_90px_-32px] shadow-primary/90",
          compact ? "p-4" : "p-6 sm:p-8",
        )}
        style={{ background: hue, transform: "rotateX(0.6deg)" }}
      >
        {/* shine + density layers */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_10%_-20%,rgba(255,255,255,0.55),transparent_58%)]"
          style={{ opacity: "var(--banner-shine, 0.85)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),transparent_38%,rgba(0,0,0,0.18))]"
          style={{ opacity: "calc(0.5 + 0.5 * var(--banner-shine, 0.85))" }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.5)_1px,transparent_0)] [background-size:18px_18px]" />
        <div
          className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/40 blur-3xl"
          style={{ opacity: "var(--banner-glow-density, 0.9)" }}
        />
        <div

          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/20 blur-xl"
          style={{ animation: "kpi-sweep 4.5s ease-in-out infinite" }}
        />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] backdrop-blur",
                  style.chip,
                )}
              >
                <Icon className="h-3 w-3" />
                {style.label}
              </span>
              {item.meta && (
                <span className="rounded-full border border-white/60 bg-white/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#12203f] backdrop-blur">
                  {item.meta}
                </span>
              )}
              {item.done && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/60 px-2.5 py-1 text-[10px] font-bold uppercase text-[#0d5a3f]">
                  <CheckCircle2 className="h-3 w-3" /> Done
                </span>
              )}
            </div>

            <h2
              className={cn(
                "mt-3 font-extrabold leading-tight tracking-[-0.02em] text-[#0f1b38] drop-shadow-[0_2px_10px_rgba(255,255,255,0.55)]",
                compact ? "text-base" : "text-2xl sm:text-3xl",
              )}
            >
              {item.title}
            </h2>
            <p className={cn("mt-2 max-w-2xl text-[#1b2a4d]/85", compact ? "text-[11px]" : "text-sm")}>
              {item.detail}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (item.kind === "todo") {
                    completeBannerItem(item.id);
                    toast.success(`Marked done: ${item.title}`);
                  } else {
                    resolveBannerItem(item.id);
                    toast.success(`${primaryLabel}d: ${item.title}`);
                  }
                }}
                className="inline-flex items-center gap-2 rounded-full bg-[#0f1b38] px-4 py-2 text-xs font-extrabold text-white shadow-[0_12px_30px_-12px_rgba(0,0,0,0.9)] transition-transform hover:scale-105 active:scale-95"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  resolveBannerItem(item.id);
                  toast.info(`Dismissed: ${item.title}`);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-4 py-2 text-xs font-bold text-[#0f1b38] backdrop-blur transition-colors hover:bg-white/70"
              >
                <X className="h-3.5 w-3.5" />
                {item.secondaryLabel ?? "Dismiss"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying((p) => !p);
                  toast.message(playing ? "Slider paused" : "Slider playing");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-3 py-2 text-xs font-bold text-[#0f1b38] backdrop-blur transition-colors hover:bg-white/70"
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Pause" : "Play"}
              </button>
            </div>
          </div>

          {/* nav */}
          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(-1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/45 text-[#0f1b38] backdrop-blur transition-transform hover:scale-110"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full border border-white/70 bg-white/45 px-3 py-1 text-[11px] font-bold text-[#0f1b38]">
              {safeIndex + 1}/{count}
            </span>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/70 bg-white/45 text-[#0f1b38] backdrop-blur transition-transform hover:scale-110"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* dots */}
        <div className="relative mt-4 flex items-center gap-1.5">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === safeIndex ? "w-8 bg-[#0f1b38]" : "w-3 bg-white/70 hover:bg-white",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default SliderBanner;
