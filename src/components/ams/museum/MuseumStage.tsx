import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download, Maximize2, Pause, RotateCw, ZoomIn, ZoomOut, Move, Search,
  Layers, Grid3x3, Palette, Sun, Ruler, Sparkles, X,
} from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useCelebration, type CelebrateKind } from "@/components/ams/effects/Celebration";
import { SVMicroMark, SVSeal, svCollectionNumber } from "@/components/ams/brand/SVMark";
import {
  FACE_VIEWS, LIGHTING_PRESETS, PREVIEW_MODES, SCALE_PRESETS,
  type FaceView, type LightingPreset, type MuseumEnvironment, type PreviewMode, type ScalePreset,
} from "@/lib/ams/museum";
import { cn } from "@/lib/utils";

const PLINTH: Record<MuseumEnvironment["plinth"], string> = {
  marble: "linear-gradient(180deg, #efeae1 0%, #cfc7ba 40%, #8d8578 100%)",
  "brushed-steel": "linear-gradient(180deg, #d9dee6 0%, #9aa4b1 45%, #5b6572 100%)",
  walnut: "linear-gradient(180deg, #6b4326 0%, #4a2d18 50%, #2a1a0e 100%)",
  obsidian: "linear-gradient(180deg, #23262d 0%, #14161b 50%, #070809 100%)",
  leather: "linear-gradient(180deg, #5c3a24 0%, #3d2517 55%, #1f130b 100%)",
  glass: "linear-gradient(180deg, rgba(226,240,255,0.55) 0%, rgba(140,180,220,0.28) 50%, rgba(10,20,35,0.6) 100%)",
};

export interface MuseumStageProps {
  src: string;
  filename: string;
  accent: string;
  label: string;
  environment: MuseumEnvironment;
  material: string;
  height?: number;
  /** Compact chrome for grid cards, full chrome for hero/showcase stages. */
  chrome?: "compact" | "full";
  unlockKind?: CelebrateKind;
  unlockTitle?: string;
  unlockSubtitle?: string;
  onExpand?: () => void;
  eager?: boolean;
}

/**
 * MuseumStage — luxury glass cabinet + floating display platform + spotlight +
 * reflection floor with the full premium preview toolkit (auto/manual rotate,
 * zoom, pan, inspect, explosion, wireframe, material preview, face views,
 * lighting + environment switching, scale presets and cinematic reveal).
 * Presentation only: no data, no network beyond fetching the PNG for download.
 */
export function MuseumStage({
  src, filename, accent, label, environment, material,
  height = 380, chrome = "compact",
  unlockKind = "trophy", unlockTitle, unlockSubtitle, onExpand, eager = false,
}: MuseumStageProps) {
  const reducedMotion = useReducedMotion();
  const { celebrate } = useCelebration();

  const [mode, setMode] = useState<PreviewMode>("auto");
  const [face, setFace] = useState<FaceView>("front");
  const [lighting, setLighting] = useState<LightingPreset>("spotlight");
  const [scaleKey, setScaleKey] = useState<ScalePreset>("display");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(eager);
  const [visible, setVisible] = useState(eager);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (eager) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setMounted(true); setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { setMounted(true); setVisible(true); } else setVisible(false);
      }
    }, { rootMargin: "220px", threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);

  const light = LIGHTING_PRESETS.find((l) => l.key === lighting)!;
  const scalePreset = SCALE_PRESETS.find((s) => s.key === scaleKey)!;
  const faceDef = FACE_VIEWS.find((f) => f.key === face)!;
  const animate = !reducedMotion && visible;
  const autoSpin = mode === "auto" && animate;

  const objectStyle = useMemo(() => {
    const rotY = faceDef.rotateY + (mode === "manual" || mode === "inspect" ? drag.x : 0);
    const rotX = faceDef.rotateX + (mode === "manual" || mode === "inspect" ? drag.y : 0);
    const s = scalePreset.scale * zoom;
    return {
      transformStyle: "preserve-3d" as const,
      transform: autoSpin
        ? undefined
        : `translate(${pan.x}px, ${pan.y}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${s})`,
      animation: autoSpin ? "collectible-spin 16s linear infinite" : "none",
      width: height * 0.66,
      height: height * 0.82,
      willChange: autoSpin || mode === "manual" ? "transform" : undefined,
      transition: mode === "manual" || mode === "pan" ? "none" : "transform 600ms cubic-bezier(0.22,1,0.36,1)",
    };
  }, [autoSpin, drag, face, faceDef, height, mode, pan, scalePreset.scale, zoom]);

  const imageFilter = useMemo(() => {
    const glow = `drop-shadow(0 24px 48px ${accent}aa) drop-shadow(0 0 22px ${accent}66)`;
    if (mode === "wireframe") return `${glow} grayscale(1) contrast(2.4) brightness(1.5) invert(0.08)`;
    if (mode === "material") return `${glow} saturate(1.5) contrast(1.25) brightness(${0.9 + light.intensity * 0.25})`;
    if (mode === "inspect") return `${glow} contrast(1.15) brightness(1.08)`;
    return `${glow} brightness(${0.85 + light.intensity * 0.2})`;
  }, [accent, light.intensity, mode]);

  function onPointerDown(e: React.PointerEvent) {
    if (mode !== "manual" && mode !== "inspect" && mode !== "pan") return;
    pointer.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!pointer.current) return;
    const dx = e.clientX - pointer.current.x;
    const dy = e.clientY - pointer.current.y;
    pointer.current = { x: e.clientX, y: e.clientY };
    if (mode === "pan") setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    else setDrag((d) => ({ x: d.x + dx * 0.6, y: Math.max(-80, Math.min(80, d.y - dy * 0.4)) }));
  }
  function onPointerUp() { pointer.current = null; }

  async function download() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { window.open(src, "_blank"); }
  }

  const explode = mode === "explosion";

  return (
    <div
      ref={wrapRef}
      data-museum-stage
      className="relative w-full overflow-hidden rounded-2xl border"
      style={{
        height,
        perspective: "1400px",
        borderColor: `${accent}55`,
        background: environment.backdrop,
        boxShadow: `inset 0 0 90px ${accent}1f, 0 40px 80px -40px ${accent}55`,
        contain: "content",
      }}
    >
      {/* ambient environment glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(70% 45% at 50% 0%, ${environment.ambient}${Math.round(light.intensity * 40).toString(16).padStart(2, "0")}, transparent 70%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* spotlight cone */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2"
        style={{
          width: height * 0.9, height: height * 0.8,
          background: `conic-gradient(from 200deg at 50% 0%, transparent 0deg, ${accent}${lighting === "vault" ? "18" : "3a"} 22deg, transparent 44deg)`,
          filter: "blur(14px)", opacity: 0.6 + light.intensity * 0.25,
        }}
      />
      {/* cinematic rim sweep */}
      {animate && lighting !== "vault" && (
        <div
          className="pointer-events-none absolute inset-0 collectible-rim opacity-60"
          style={{
            background: `conic-gradient(from 0deg, transparent, ${accent}44, transparent 32%, ${accent}2a, transparent 66%, ${accent}55, transparent)`,
            mixBlendMode: "screen", filter: "blur(34px)",
          }}
        />
      )}
      {/* wireframe grid overlay */}
      {mode === "wireframe" && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: `linear-gradient(${accent}55 1px, transparent 1px), linear-gradient(90deg, ${accent}55 1px, transparent 1px)`,
            backgroundSize: "22px 22px",
          }}
        />
      )}

      {/* object on floating platform */}
      <div
        className={cn(
          "relative flex h-full w-full items-center justify-center",
          (mode === "manual" || mode === "inspect") && "cursor-grab active:cursor-grabbing",
          mode === "pan" && "cursor-move",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!mounted ? (
          <div className="h-24 w-24 animate-pulse rounded-full"
            style={{ background: `radial-gradient(closest-side, ${accent}44, transparent)` }} />
        ) : (
          <div className="relative" style={objectStyle}>
            <img
              src={src}
              alt={label}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              width={1024}
              height={1024}
              className="h-full w-full object-contain"
              style={{
                filter: imageFilter,
                backfaceVisibility: "hidden",
                transform: explode ? "translateY(-6%) scale(0.9)" : undefined,
                transition: "transform 500ms cubic-bezier(0.22,1,0.36,1)",
                mixBlendMode: mode === "wireframe" ? "screen" : undefined,
              }}
            />
            {/* explosion view — separated construction layers */}
            {explode && (
              <>
                <div className="pointer-events-none absolute inset-0 -translate-y-[26%] scale-[0.72] opacity-45"
                  style={{ background: `radial-gradient(closest-side, ${accent}55, transparent 70%)`, borderRadius: "50%" }} />
                <div className="pointer-events-none absolute inset-x-6 bottom-[-14%] h-10 rounded-[50%] border"
                  style={{ borderColor: `${accent}77`, background: `${accent}18` }} />
                <div className="pointer-events-none absolute inset-x-12 bottom-[-30%] h-8 rounded-[50%] border"
                  style={{ borderColor: `${accent}55`, background: `${accent}0f` }} />
              </>
            )}
            {animate && mode !== "wireframe" && (
              <div className="trophy-shine pointer-events-none absolute inset-0"
                style={{ background: `linear-gradient(115deg, transparent 40%, ${accent}55 50%, transparent 60%)`, mixBlendMode: "screen" }} />
            )}
          </div>
        )}

        {/* reflection floor + plinth */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: height * 0.3 }}>
          <div className="absolute inset-x-0 bottom-0 h-full"
            style={{ background: `linear-gradient(180deg, transparent, ${environment.floor})`, opacity: 0.8 }} />
          <div className="absolute bottom-3 left-1/2 h-3 -translate-x-1/2 rounded-full"
            style={{ width: height * 0.5, background: `radial-gradient(closest-side, ${accent}cc, transparent 70%)`, filter: "blur(9px)" }} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-[10px] border-t"
            style={{
              width: height * 0.62, height: 18,
              background: PLINTH[environment.plinth],
              borderColor: `${accent}66`,
              boxShadow: `0 -8px 22px -10px ${accent}88`,
            }} />
        </div>

        {/* luxury glass cabinet */}
        <div className="pointer-events-none absolute inset-2 rounded-xl border"
          style={{
            borderColor: `${accent}33`,
            background: "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, transparent 28%, transparent 72%, rgba(255,255,255,0.045) 100%)",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(255,255,255,0.06)`,
          }} />
      </div>

      {/* brand marks */}
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
        <SVSeal accent={accent} />
        <SVMicroMark accent={accent} className="hidden sm:inline" />
      </div>
      <div className="absolute bottom-2 left-3 z-10 font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: "0.28em", color: `${accent}bb` }}>
        {label}
      </div>
      <div className="absolute bottom-2 right-3 z-10 font-mono uppercase"
        style={{ fontSize: 9, letterSpacing: "0.22em", color: `${accent}aa` }}>
        {svCollectionNumber(filename, label.split(" · ")[0].replace(/^SV-/, "").toLowerCase())}
      </div>

      {/* controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1.5">
          <StageBtn active={mode === "auto"} onClick={() => setMode(mode === "auto" ? "manual" : "auto")}
            accent={accent} title={mode === "auto" ? "Pause auto rotate" : "Auto rotate"}>
            {mode === "auto" ? <Pause className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
          </StageBtn>
          <StageBtn accent={accent} title="Zoom in" onClick={() => setZoom((z) => Math.min(2.6, +(z + 0.2).toFixed(2)))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </StageBtn>
          <StageBtn accent={accent} title="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(2)))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </StageBtn>
          <StageBtn accent={accent} active={mode === "pan"} title="Pan" onClick={() => setMode(mode === "pan" ? "auto" : "pan")}>
            <Move className="h-3.5 w-3.5" />
          </StageBtn>
          {onExpand && (
            <StageBtn accent={accent} title="Fullscreen view" onClick={onExpand}>
              <Maximize2 className="h-3.5 w-3.5" />
            </StageBtn>
          )}
          <button type="button" onClick={download} title="Download PNG"
            className="flex h-8 items-center gap-1.5 rounded-md border bg-black/45 px-2.5 text-[11px] font-medium text-white/90 backdrop-blur transition hover:bg-black/65"
            style={{ borderColor: `${accent}66` }}>
            <Download className="h-3.5 w-3.5" /> PNG
          </button>
        </div>

        {chrome === "full" && (
          <div className="flex flex-wrap justify-end gap-1.5">
            <StageBtn accent={accent} active={mode === "inspect"} title="Inspect mode"
              onClick={() => setMode(mode === "inspect" ? "auto" : "inspect")}><Search className="h-3.5 w-3.5" /></StageBtn>
            <StageBtn accent={accent} active={mode === "explosion"} title="Explosion view"
              onClick={() => setMode(mode === "explosion" ? "auto" : "explosion")}><Layers className="h-3.5 w-3.5" /></StageBtn>
            <StageBtn accent={accent} active={mode === "wireframe"} title="Wireframe view"
              onClick={() => setMode(mode === "wireframe" ? "auto" : "wireframe")}><Grid3x3 className="h-3.5 w-3.5" /></StageBtn>
            <StageBtn accent={accent} active={mode === "material"} title="Material preview"
              onClick={() => setMode(mode === "material" ? "auto" : "material")}><Palette className="h-3.5 w-3.5" /></StageBtn>
          </div>
        )}
      </div>

      {/* premium detail rail */}
      {chrome === "full" && (
        <div className="absolute inset-x-3 bottom-8 z-10 flex flex-wrap items-center gap-1.5">
          {FACE_VIEWS.map((f) => (
            <Chip key={f.key} accent={accent} active={face === f.key}
              onClick={() => { setFace(f.key); setMode("manual"); setDrag({ x: 0, y: 0 }); }}>
              {f.label}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px" style={{ background: `${accent}44` }} />
          {LIGHTING_PRESETS.map((l) => (
            <Chip key={l.key} accent={accent} active={lighting === l.key} onClick={() => setLighting(l.key)}>
              <Sun className="mr-1 inline h-3 w-3" />{l.label}
            </Chip>
          ))}
          <span className="mx-1 h-4 w-px" style={{ background: `${accent}44` }} />
          {SCALE_PRESETS.map((s) => (
            <Chip key={s.key} accent={accent} active={scaleKey === s.key} onClick={() => setScaleKey(s.key)} title={s.note}>
              <Ruler className="mr-1 inline h-3 w-3" />{s.label}
            </Chip>
          ))}
          <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: `${accent}aa` }}>
            {material} · {environment.name} · {PREVIEW_MODES.find((p) => p.key === mode)?.label}
          </span>
        </div>
      )}

      {(unlockTitle || unlockSubtitle) && (
        <button
          type="button"
          onClick={() => celebrate({ kind: unlockKind, title: unlockTitle ?? label, subtitle: unlockSubtitle })}
          className={cn(
            "absolute z-10 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition hover:brightness-110",
            chrome === "full" ? "right-3 top-24" : "bottom-8 right-3",
          )}
          style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, color: "#0b0f1a", boxShadow: `0 0 22px -6px ${accent}` }}
        >
          <Sparkles className="h-3.5 w-3.5" /> Reveal
        </button>
      )}
    </div>
  );
}

function StageBtn({
  children, onClick, accent, title, active = false,
}: { children: React.ReactNode; onClick: () => void; accent: string; title: string; active?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} title={title} aria-label={title} aria-pressed={active}
      className="flex h-8 w-8 items-center justify-center rounded-md border text-white/90 backdrop-blur transition hover:bg-black/65"
      style={{ borderColor: `${accent}66`, background: active ? `${accent}44` : "rgba(0,0,0,0.45)" }}
    >
      {children}
    </button>
  );
}

function Chip({
  children, onClick, accent, active = false, title,
}: { children: React.ReactNode; onClick: () => void; accent: string; active?: boolean; title?: string }) {
  return (
    <button
      type="button" onClick={onClick} title={title} aria-pressed={active}
      className="rounded-md border px-2 py-1 text-[10px] font-medium tracking-wide backdrop-blur transition"
      style={{
        borderColor: active ? accent : `${accent}33`,
        background: active ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : "rgba(0,0,0,0.4)",
        color: active ? "#08121f" : `${accent}dd`,
      }}
    >
      {children}
    </button>
  );
}

/** Cinematic fullscreen presentation overlay for a single collectible. */
export function MuseumFullscreen({
  open, onClose, ...stage
}: MuseumStageProps & { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4 backdrop-blur-xl motion-rise" role="dialog" aria-modal="true"
      aria-label={`${stage.label} fullscreen presentation`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: `${stage.accent}cc` }}>
          {stage.label} · {stage.environment.name}
        </div>
        <button type="button" onClick={onClose} aria-label="Close fullscreen view"
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-foreground/80 hover:bg-muted/40">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <MuseumStage {...stage} chrome="full" height={720} eager onExpand={undefined} />
      </div>
    </div>
  );
}
