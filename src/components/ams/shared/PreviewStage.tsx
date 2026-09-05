import { useState } from "react";
import { Volume2, Sparkles, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCelebration } from "@/components/ams/effects/Celebration";
import { ProceduralEmblem } from "./ProceduralEmblem";
import { RARITY_META, type Award } from "@/lib/ams/types";

type PreviewAward = Pick<Award, "name" | "type" | "rarity" | "media"> &
  Partial<Pick<Award, "id" | "department">>;

export function PreviewStage({ award }: { award: PreviewAward }) {
  const { celebrate } = useCelebration();
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const playSound = () => {
    if (!award.media.soundUrl) return;
    if (audio) audio.pause();
    const a = new Audio(award.media.soundUrl);
    setAudio(a); a.play().catch(() => undefined);
  };

  const meta = RARITY_META[award.rarity];
  const emblemAward = {
    id: award.id ?? `preview:${award.name}:${award.type}:${award.rarity}`,
    type: award.type, rarity: award.rarity, department: award.department, media: award.media,
  };

  return (
    <div className="surface-card relative overflow-hidden p-8">
      <div
        className="absolute inset-0 opacity-50"
        style={{ background: `radial-gradient(ellipse at center, ${meta.hue}33, transparent 65%)` }}
      />
      <div className="relative flex flex-col items-center gap-6">
        <div className="grid h-52 w-52 place-items-center rounded-full"
             style={{ background: `radial-gradient(circle, ${meta.glow}, transparent 70%)` }}>
          {award.media.model3dUrl ? (
            <img src={award.media.model3dUrl} alt={award.name} className="h-44 w-44 drop-shadow-[0_20px_50px_rgba(0,0,0,0.6)]" />
          ) : (
            <ProceduralEmblem award={emblemAward} size={200} />
          )}
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: meta.hue }}>{meta.label} · {award.type}</div>
          <div className="mt-1 font-display text-2xl font-bold text-gradient-trophy">{award.name}</div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm" variant="outline" className="gap-1.5"
            onClick={() => celebrate({ kind: award.type === "trophy" ? "trophy" : award.type === "badge" ? "badge" : "achievement", title: award.name, subtitle: "Preview unlock" })}
          >
            <Sparkles className="h-3.5 w-3.5" /> Simulate unlock
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={playSound} disabled={!award.media.soundUrl}>
            <Volume2 className="h-3.5 w-3.5" /> Play sound
          </Button>
          {award.media.gifUrl && (
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={award.media.gifUrl} target="_blank" rel="noreferrer"><Play className="h-3.5 w-3.5" /> Open GIF</a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
