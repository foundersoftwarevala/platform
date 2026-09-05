import { Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUiSound } from "@/hooks/use-ui-sound";
import { useReducedMotion, setReducedMotionOverride } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const SAMPLES = [
  { label: "Success", sound: "success" as const },
  { label: "Notification", sound: "notification" as const },
  { label: "Save", sound: "save" as const },
  { label: "Trophy", sound: "trophy" as const },
] as const;

/**
 * Global control for the enterprise UI sound system:
 * mute toggle, volume, and cue previews. Preferences persist locally.
 */
export function SoundControl({ className }: { className?: string }) {
  const { prefs, play, setEnabled, setVolume } = useUiSound();
  const reduced = useReducedMotion();
  const Icon = prefs.enabled && prefs.volume > 0 ? Volume2 : VolumeX;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={prefs.enabled ? "Interface sound settings (on)" : "Interface sound settings (muted)"}
              className={cn(className)}
            >
              <Icon className={cn("h-4 w-4", prefs.enabled ? "text-trophy" : "text-muted-foreground")} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Interface sound</TooltipContent>
      </Tooltip>

      <PopoverContent align="end" className="w-72 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Interface sound</div>
            <p className="text-xs text-muted-foreground">
              Soft, minimal cues for actions and alerts.
            </p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={setEnabled}
            aria-label="Enable interface sound"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="ui-sound-volume" className="text-xs text-muted-foreground">
              Volume
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(prefs.volume * 100)}%
            </span>
          </div>
          <Slider
            id="ui-sound-volume"
            value={[Math.round(prefs.volume * 100)]}
            max={100}
            step={5}
            disabled={!prefs.enabled}
            onValueChange={([v]) => setVolume((v ?? 0) / 100)}
            onValueCommit={() => play("click")}
            aria-label="Interface sound volume"
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5"
            disabled={!prefs.enabled}
            onClick={() => play("achievement")}
          >
            <Play className="h-3.5 w-3.5" /> Test sound at this volume
          </Button>
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <div className="text-xs font-medium">Reduced motion</div>
            <p className="text-[11px] text-muted-foreground">
              Skip celebration, reveal and XP animations.
            </p>
          </div>
          <Switch
            checked={reduced}
            onCheckedChange={(v) => setReducedMotionOverride(v ? true : null)}
            aria-label="Reduced motion"
          />
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Preview</div>
          <div className="grid grid-cols-2 gap-2">
            {SAMPLES.map((s) => (
              <Button
                key={s.label}
                variant="outline"
                size="sm"
                disabled={!prefs.enabled}
                onClick={() => play(s.sound)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
