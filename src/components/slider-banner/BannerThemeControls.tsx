/**
 * Compact popover-free inline controls for banner glow density + shine.
 */

import { useEffect, useState } from "react";
import { Sparkles, Sun, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  hydrateBannerTheme,
  resetBannerTheme,
  setBannerTheme,
  useBannerTheme,
} from "./bannerTheme";

function Slider({
  label,
  icon: Icon,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  icon: typeof Sun;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex min-w-[150px] flex-1 items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary-glow" />
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-foreground/70">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-primary/30 accent-[var(--color-primary-glow)]"
        aria-label={label}
      />
      <span className="w-8 shrink-0 text-right text-[10px] font-bold text-foreground/70">
        {Math.round(value * 100)}
      </span>
    </label>
  );
}

export function BannerThemeControls({ className }: { className?: string }) {
  const theme = useBannerTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    hydrateBannerTheme();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-2xl border-2 border-primary-glow/35 bg-card/70 px-4 py-2.5 backdrop-blur",
        className,
      )}
    >
      <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-foreground/60">
        Banner Theme
      </span>
      <Slider
        label="Glow"
        icon={Sparkles}
        value={theme.glowDensity}
        min={0.2}
        max={1.6}
        onChange={(v) => setBannerTheme({ glowDensity: v })}
      />
      <Slider
        label="Shine"
        icon={Sun}
        value={theme.shine}
        min={0}
        max={1.4}
        onChange={(v) => setBannerTheme({ shine: v })}
      />
      <button
        type="button"
        onClick={resetBannerTheme}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary-glow/40 bg-primary/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-primary/35"
      >
        <RotateCcw className="h-3 w-3" /> Reset
      </button>
    </div>
  );
}

export default BannerThemeControls;
