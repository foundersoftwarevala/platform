/**
 * SETTINGS
 * Every row is backed by assist_settings. Locked rows are enforced by database policy.
 */

import { useMemo } from "react";
import { Lock, Settings as SettingsIcon, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings, useUpdateSetting } from "@/lib/assist-manager/hooks";
import type { SettingRow } from "@/lib/assist-manager/types";
import { LoadingBlock, ScreenHeader, sectionIcon } from "../am-ui";

const OPTION_LABELS: Record<string, string> = {
  auto: "Auto-approve",
  manager: "Manager approval",
  dual: "Dual approval",
  boss_owner: "Boss Owner approval",
};

function optionLabel(value: string) {
  if (OPTION_LABELS[value]) return OPTION_LABELS[value];
  return /^\d+$/.test(value) ? `${value} min` : value;
}

export function AMSettings() {
  const { data: settings = [], isLoading } = useSettings();
  const updateSetting = useUpdateSetting();

  const sections = useMemo(() => {
    const map = new Map<string, SettingRow[]>();
    for (const row of settings) {
      const list = map.get(row.section) ?? [];
      list.push(row);
      map.set(row.section, list);
    }
    return Array.from(map.entries());
  }, [settings]);

  const lockedCount = settings.filter((s) => s.is_locked).length;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Settings"
          subtitle="Configure assist manager defaults and policies"
          actions={
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              {lockedCount} policy-locked
            </Badge>
          }
        />

        {isLoading ? (
          <LoadingBlock rows={6} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {sections.map(([section, rows]) => {
              const Icon = sectionIcon(section);
              return (
                <Card key={section}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="h-5 w-5" />
                      {section}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {rows.map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{row.label}</span>
                          {row.is_locked && (
                            <Lock className="h-3 w-3 text-muted-foreground" />
                          )}
                        </div>

                        {row.control_type === "toggle" && (
                          <Switch
                            checked={row.value === "true"}
                            disabled={row.is_locked || updateSetting.isPending}
                            onCheckedChange={(checked) =>
                              updateSetting.mutate({ id: row.id, value: String(checked) })
                            }
                          />
                        )}

                        {row.control_type === "number" && (
                          <Input
                            type="number"
                            min={1}
                            className="w-24"
                            value={row.value}
                            disabled={row.is_locked || updateSetting.isPending}
                            onChange={(e) =>
                              updateSetting.mutate({ id: row.id, value: e.target.value })
                            }
                          />
                        )}

                        {row.control_type === "select" && (
                          <Select
                            value={row.value}
                            disabled={row.is_locked || updateSetting.isPending}
                            onValueChange={(value) => updateSetting.mutate({ id: row.id, value })}
                          >
                            <SelectTrigger className="w-44">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(row.options ?? []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {optionLabel(opt)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-primary">Policy-Locked Settings</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Settings marked with a lock are enforced by security policy in the database and
                  cannot be changed from this console. Every unlocked change is written to the
                  audit trail.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <SettingsIcon className="h-4 w-4" />
              Configuration Source
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            All values are read from and written to the live assist settings store — no local or
            mock configuration is used anywhere in this module.
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMSettings;
