import { Volume2, Waves, Play, Gauge } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUiSound } from "@/hooks/use-ui-sound";
import { useReducedMotion, setReducedMotionOverride } from "@/hooks/use-reduced-motion";
import type { UiSound } from "@/lib/ams/ui-sound";

const CUES: { label: string; sound: UiSound }[] = [
  { label: "Save", sound: "save" },
  { label: "Publish", sound: "publish" },
  { label: "Approval", sound: "approval" },
  { label: "Rejection", sound: "rejection" },
  { label: "Archive", sound: "archive" },
  { label: "Delete", sound: "delete" },
  { label: "Import done", sound: "importComplete" },
  { label: "Export done", sound: "exportComplete" },
  { label: "New message", sound: "message" },
  { label: "Mention", sound: "mention" },
  { label: "Notification", sound: "notification" },
  { label: "AI response", sound: "ai" },
  { label: "Achievement", sound: "achievement" },
  { label: "Reward", sound: "reward" },
  { label: "Badge", sound: "badge" },
  { label: "Trophy", sound: "trophy" },
  { label: "Verification", sound: "verified" },
  { label: "Warning", sound: "warning" },
  { label: "Error", sound: "error" },
];

/** Workspace-level preferences for the enterprise motion + sound language. */
export function MotionSoundPanel() {
  const { prefs, play, setEnabled, setVolume } = useUiSound();
  const reduced = useReducedMotion();

  return (
    <section className="surface-card p-5 space-y-5" aria-labelledby="motion-sound-heading">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted/30 text-trophy">
            <Waves className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 id="motion-sound-heading" className="truncate text-sm font-semibold">
              Motion &amp; Sound
            </h2>
            <p className="text-xs text-muted-foreground">
              Subtle interface cues for actions, alerts and recognition events.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="settings-sound-enabled" className="text-xs text-muted-foreground">
            {prefs.enabled ? "On" : "Muted"}
          </Label>
          <Switch id="settings-sound-enabled" checked={prefs.enabled} onCheckedChange={setEnabled} />
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="settings-sound-volume" className="text-xs text-muted-foreground">
              <Volume2 className="mr-1.5 inline h-3.5 w-3.5" /> Volume
            </Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round(prefs.volume * 100)}%
            </span>
          </div>
          <Slider
            id="settings-sound-volume"
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
            <Play className="h-3.5 w-3.5" /> Test achievement sound
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Move the slider, then test to hear the level you picked.
          </p>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3">
            <div className="min-w-0">
              <Label htmlFor="settings-reduced-motion" className="text-xs font-medium">
                <Gauge className="mr-1.5 inline h-3.5 w-3.5" /> Reduced motion
              </Label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Turns off celebration, reveal and XP count-up animations. State changes still update instantly.
              </p>
            </div>
            <Switch
              id="settings-reduced-motion"
              checked={reduced}
              onCheckedChange={(v) => setReducedMotionOverride(v ? true : null)}
              aria-label="Reduced motion"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Sound library
          </div>
          <div className="flex flex-wrap gap-2">
            {CUES.map((c) => (
              <Button
                key={c.label}
                variant="outline"
                size="sm"
                disabled={!prefs.enabled}
                sound={c.sound}
              >
                {c.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
