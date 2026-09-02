import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, type Preferences } from "@/hooks/use-preferences";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}

/** Real user preferences — every toggle takes effect immediately and persists. */
export function PreferencesDialog({ open, onOpenChange, prefs, update }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Preferences</DialogTitle>
          <DialogDescription>Personal chat settings. Changes apply instantly.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-theme" className="flex flex-col gap-0.5">
              <span>Dark mode</span>
              <span className="text-xs font-normal text-muted-foreground">Default theme for the workspace</span>
            </Label>
            <Switch
              id="pref-theme"
              checked={prefs.theme === "dark"}
              onCheckedChange={(checked) => update({ theme: checked ? "dark" : "light" })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-sound" className="flex flex-col gap-0.5">
              <span>Sound cues</span>
              <span className="text-xs font-normal text-muted-foreground">Play a short tone on send / receive</span>
            </Label>
            <Switch id="pref-sound" checked={prefs.sound} onCheckedChange={(sound) => update({ sound })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-enter" className="flex flex-col gap-0.5">
              <span>Enter to send</span>
              <span className="text-xs font-normal text-muted-foreground">Shift+Enter adds a new line</span>
            </Label>
            <Switch
              id="pref-enter"
              checked={prefs.enterToSend}
              onCheckedChange={(enterToSend) => update({ enterToSend })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-autotranslate" className="flex flex-col gap-0.5">
              <span>Real-time translate</span>
              <span className="text-xs font-normal text-muted-foreground">
                Automatically translate incoming messages
              </span>
            </Label>
            <Switch
              id="pref-autotranslate"
              checked={prefs.autoTranslate}
              onCheckedChange={(autoTranslate) => update({ autoTranslate })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-motion" className="flex flex-col gap-0.5">
              <span>Reduce motion</span>
              <span className="text-xs font-normal text-muted-foreground">Minimise animations</span>
            </Label>
            <Switch
              id="pref-motion"
              checked={prefs.reducedMotion}
              onCheckedChange={(reducedMotion) => update({ reducedMotion })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pref-language">Translate to</Label>
              <Select value={prefs.language} onValueChange={(language) => update({ language })}>
                <SelectTrigger id="pref-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pref-density">Density</Label>
              <Select
                value={prefs.density}
                onValueChange={(density) => update({ density: density as Preferences["density"] })}
              >
                <SelectTrigger id="pref-density">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">Comfortable</SelectItem>
                  <SelectItem value="compact">Compact</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
