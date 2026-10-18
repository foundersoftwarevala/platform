import { Lock } from "lucide-react";
import { Switch } from "@/components/rd-module/ui/switch";
import { usePMSettings } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMEmpty, PMLoading, PMPanel, PMSection } from "../pm-ui";

export const PROSettings = () => {
  const { data, isLoading } = usePMSettings();
  const { toggleSetting, run } = useProManagerActions();
  const settings = data ?? [];

  const sections = Array.from(new Set(settings.map((s) => s.section)));

  return (
    <PMSection
      title="Settings"
      description="Pro Manager operating switches. Locked switches require higher authorization and cannot be changed here."
    >
      {isLoading ? (
        <PMPanel>
          <PMLoading rows={4} />
        </PMPanel>
      ) : settings.length === 0 ? (
        <PMPanel>
          <PMEmpty message="No settings configured." />
        </PMPanel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <PMPanel key={section} title={section}>
              <ul className="space-y-3">
                {settings
                  .filter((s) => s.section === section)
                  .map((setting) => (
                    <li key={setting.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {setting.locked && <Lock className="h-3.5 w-3.5 text-warning" />}
                        <span className="text-sm text-foreground">{setting.label}</span>
                      </div>
                      <Switch
                        checked={setting.enabled}
                        disabled={setting.locked}
                        aria-label={setting.label}
                        onCheckedChange={(checked) =>
                          void run(
                            `${setting.label} ${checked ? "enabled" : "disabled"}`,
                            toggleSetting({ data: { key: setting.key, enabled: checked } }),
                          )
                        }
                      />
                    </li>
                  ))}
              </ul>
            </PMPanel>
          ))}
        </div>
      )}
    </PMSection>
  );
};
