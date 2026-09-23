import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES, type Preferences } from "@/hooks/use-preferences";
import { useTranslation } from "@/lib/i18n/use-translation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: Preferences;
  update: (patch: Partial<Preferences>) => void;
}

/** Real user preferences — every toggle takes effect immediately and persists. */
export function PreferencesDialog({ open, onOpenChange, prefs, update }: Props) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("chat.header.preferences")}</DialogTitle>
          <DialogDescription>{t("chat.prefs.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-theme" className="flex flex-col gap-0.5">
              <span>{t("chat.prefs.dark_mode")}</span>
              <span className="text-xs font-normal text-muted-foreground">{t("chat.prefs.dark_mode_hint")}</span>
            </Label>
            <Switch
              id="pref-theme"
              checked={prefs.theme === "dark"}
              onCheckedChange={(checked) => update({ theme: checked ? "dark" : "light" })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-sound" className="flex flex-col gap-0.5">
              <span>{t("chat.prefs.sound")}</span>
              <span className="text-xs font-normal text-muted-foreground">{t("chat.prefs.sound_hint")}</span>
            </Label>
            <Switch id="pref-sound" checked={prefs.sound} onCheckedChange={(sound) => update({ sound })} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-enter" className="flex flex-col gap-0.5">
              <span>{t("chat.prefs.enter_to_send")}</span>
              <span className="text-xs font-normal text-muted-foreground">{t("chat.prefs.enter_to_send_hint")}</span>
            </Label>
            <Switch
              id="pref-enter"
              checked={prefs.enterToSend}
              onCheckedChange={(enterToSend) => update({ enterToSend })}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="pref-autotranslate" className="flex flex-col gap-0.5">
              <span>{t("chat.prefs.auto_translate")}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t("chat.prefs.auto_translate_hint")}
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
              <span>{t("chat.prefs.reduce_motion")}</span>
              <span className="text-xs font-normal text-muted-foreground">{t("chat.prefs.reduce_motion_hint")}</span>
            </Label>
            <Switch
              id="pref-motion"
              checked={prefs.reducedMotion}
              onCheckedChange={(reducedMotion) => update({ reducedMotion })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pref-language">{t("chat.prefs.translate_to")}</Label>
              <Select value={prefs.language} onValueChange={(language) => update({ language })}>
                <SelectTrigger id="pref-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[min(60vh,420px)]" translate="no">
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code} className="min-h-10">
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pref-density">{t("chat.prefs.density")}</Label>
              <Select
                value={prefs.density}
                onValueChange={(density) => update({ density: density as Preferences["density"] })}
              >
                <SelectTrigger id="pref-density">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">{t("chat.prefs.density_comfortable")}</SelectItem>
                  <SelectItem value="compact">{t("chat.prefs.density_compact")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
