import { useState } from "react";
import { Upload, FileMusic, Sparkles, Film, Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface MediaValue {
  model3dUrl?: string;
  lottieUrl?: string;
  gifUrl?: string;
  soundUrl?: string;
  animatedIconUrl?: string;
  themeColor?: string;
}

function Field({
  label, icon, hint, value, onChange, accept,
}: {
  label: string; icon: React.ReactNode; hint: string;
  value?: string; onChange: (v?: string) => void; accept: string;
}) {
  const [local, setLocal] = useState(value ?? "");
  const onFile = (f: File | null) => {
    if (!f) return;
    const url = URL.createObjectURL(f);
    setLocal(url); onChange(url);
  };
  return (
    <div className="surface-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-trophy">{icon}</span>{label}
        </div>
        {local && (
          <Button size="icon" variant="ghost" title="Remove media" aria-label="Remove media" onClick={() => { setLocal(""); onChange(undefined); }}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input value={local} onChange={(e) => { setLocal(e.target.value); onChange(e.target.value || undefined); }} placeholder="https:// or upload" />
        <label className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 text-xs font-medium cursor-pointer hover:bg-muted/50">
          <Upload className="h-3.5 w-3.5" /> Upload
          <input type="file" accept={accept} className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
        </label>
      </div>
    </div>
  );
}

export function MediaUploader({
  value, onChange, className,
}: {
  value: MediaValue;
  onChange: (next: MediaValue) => void;
  className?: string;
}) {
  const patch = (p: Partial<MediaValue>) => onChange({ ...value, ...p });
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-3", className)}>
      <Field label="3D Model / Image" icon={<ImageIcon className="h-4 w-4" />} hint=".glb, .png, .jpg — preview on award detail" accept=".glb,.gltf,image/*" value={value.model3dUrl} onChange={(v) => patch({ model3dUrl: v })} />
      <Field label="Animated Icon" icon={<Sparkles className="h-4 w-4" />} hint="GIF or animated SVG" accept="image/gif,image/svg+xml" value={value.animatedIconUrl} onChange={(v) => patch({ animatedIconUrl: v })} />
      <Field label="Lottie Animation" icon={<Sparkles className="h-4 w-4" />} hint=".json (Bodymovin export)" accept="application/json" value={value.lottieUrl} onChange={(v) => patch({ lottieUrl: v })} />
      <Field label="GIF Animation" icon={<Film className="h-4 w-4" />} hint=".gif for unlock fallback" accept="image/gif" value={value.gifUrl} onChange={(v) => patch({ gifUrl: v })} />
      <Field label="Sound Effect" icon={<FileMusic className="h-4 w-4" />} hint=".mp3, .wav, .ogg" accept="audio/*" value={value.soundUrl} onChange={(v) => patch({ soundUrl: v })} />
      <div className="surface-card p-4 space-y-2">
        <Label className="text-sm font-medium flex items-center gap-2"><span className="text-trophy"><Sparkles className="h-4 w-4" /></span>Theme Color</Label>
        <p className="text-[11px] text-muted-foreground">Used for glow & rarity tint overrides</p>
        <div className="flex items-center gap-2">
          <input type="color" value={value.themeColor ?? "#c9a86a"} onChange={(e) => patch({ themeColor: e.target.value })} className="h-9 w-12 rounded-md border border-border bg-transparent" />
          <Input value={value.themeColor ?? ""} onChange={(e) => patch({ themeColor: e.target.value || undefined })} placeholder="#c9a86a" />
        </div>
      </div>
    </div>
  );
}
