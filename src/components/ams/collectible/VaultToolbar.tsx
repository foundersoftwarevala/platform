import { useState } from "react";
import { Download, Volume2, VolumeX, Zap, ZapOff, Loader2 } from "lucide-react";
import { useReducedMotion, setReducedMotionOverride } from "@/hooks/use-reduced-motion";
import { useCelebration } from "@/components/ams/effects/Celebration";

export type ExportItem = { src: string; filename: string };

async function downloadOne(item: ExportItem) {
  try {
    const res = await fetch(item.src);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {
    window.open(item.src, "_blank");
  }
}

/**
 * Shared vault controls: export the full image set (PNGs), toggle reduced motion,
 * and mute/unmute unlock sound effects.
 */
export function VaultToolbar({
  items,
  accent = "#facc15",
  exportLabel = "Export image set",
}: {
  items: ExportItem[];
  accent?: string;
  exportLabel?: string;
}) {
  const reduced = useReducedMotion();
  const { soundOn, setSoundOn } = useCelebration();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  async function exportAll() {
    if (busy || items.length === 0) return;
    setBusy(true);
    setDone(0);
    for (const item of items) {
      await downloadOne(item);
      setDone((d) => d + 1);
      await new Promise((r) => setTimeout(r, 250));
    }
    setBusy(false);
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all hover:brightness-110 disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={exportAll}
        disabled={busy}
        className={btn}
        style={{
          background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
          borderColor: accent,
          color: "#08121f",
          boxShadow: `0 8px 22px -10px ${accent}`,
        }}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        {busy ? `Exporting ${done}/${items.length}` : `${exportLabel} (${items.length} PNG)`}
      </button>

      <button
        type="button"
        onClick={() => setReducedMotionOverride(reduced ? false : true)}
        className={btn}
        style={{ borderColor: `${accent}55`, color: `${accent}dd` }}
        title="Toggle reduced motion for this app"
      >
        {reduced ? <ZapOff className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
        Motion: {reduced ? "Reduced" : "Full"}
      </button>

      <button
        type="button"
        onClick={() => setSoundOn(!soundOn)}
        className={btn}
        style={{ borderColor: `${accent}55`, color: `${accent}dd` }}
        title="Toggle unlock sound effects"
      >
        {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        Sound: {soundOn ? "On" : "Muted"}
      </button>
    </div>
  );
}
