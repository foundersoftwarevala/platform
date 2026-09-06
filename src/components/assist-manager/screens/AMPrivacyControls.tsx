/**
 * PRIVACY CONTROLS
 * Backed by assist_privacy_controls. Critical controls are locked on by policy.
 */

import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePrivacyControls, useUpdatePrivacyControl } from "@/lib/assist-manager/hooks";
import { LoadingBlock, ScreenHeader, iconFor } from "../am-ui";

export function AMPrivacyControls() {
  const { data: controls = [], isLoading } = usePrivacyControls();
  const updateControl = useUpdatePrivacyControl();

  const enabled = controls.filter((c) => c.enabled).length;
  const allOn = controls.length > 0 && enabled === controls.length;

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Privacy Controls"
          subtitle="Maximum privacy — zero data leakage"
          actions={
            <Badge variant={allOn ? "default" : "secondary"} className="gap-1">
              <Shield className="h-4 w-4" />
              {allOn ? "All Protected" : `${enabled}/${controls.length} Active`}
            </Badge>
          }
        />

        <Card
          className={allOn ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  allOn ? "bg-success/20" : "bg-warning/20"
                }`}
              >
                {allOn ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : (
                  <AlertTriangle className="h-6 w-6 text-warning" />
                )}
              </div>
              <div>
                <p className={`font-medium ${allOn ? "text-success" : "text-warning"}`}>
                  {allOn ? "Maximum Privacy Active" : "Privacy Reduced"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {enabled} of {controls.length} privacy controls are enabled.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <LoadingBlock rows={4} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {controls.map((setting) => {
              const Icon = iconFor(setting.icon);
              return (
                <Card
                  key={setting.id}
                  className={setting.enabled ? "border-success/30" : "border-destructive/30"}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            setting.enabled ? "bg-success/10" : "bg-destructive/10"
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              setting.enabled ? "text-success" : "text-destructive"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{setting.label}</p>
                            {setting.is_critical && (
                              <Badge variant="outline" className="text-xs">
                                Critical
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {setting.description}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={setting.enabled}
                        disabled={setting.is_critical || updateControl.isPending}
                        onCheckedChange={(checked) =>
                          updateControl.mutate({ id: setting.id, enabled: checked })
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-warning" />
              <div>
                <p className="text-sm font-medium text-warning">Security Warning</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Critical privacy controls are enforced by database policy and cannot be turned
                  off from the console. Every change to a non-critical control is audited.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4" />
              Default Protections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {[
                "All privacy controls enabled by default",
                "Critical controls cannot be disabled",
                "All changes logged to audit trail",
                "Auto-reset to maximum on session end",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMPrivacyControls;
