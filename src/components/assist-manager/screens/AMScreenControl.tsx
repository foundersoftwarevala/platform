/**
 * SCREEN CONTROL
 * Access mode + granular control toggles for the active session.
 */

import {
  Hand,
  Lock,
  Maximize,
  MousePointer2,
  Keyboard,
  Pause,
  Play,
  Snowflake,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useAccessModes,
  useUpdateAccessMode,
  useUpdateControlState,
} from "@/lib/assist-manager/hooks";
import type { ControlMode } from "@/lib/assist-manager/types";
import { CodeChip, EmptyState, LoadingBlock, ScreenHeader, iconFor } from "../am-ui";
import { SessionPicker, useActiveSession } from "../am-session";

const MODES: {
  key: ControlMode;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  { key: "view", label: "View Only", description: "Watch screen without any control", icon: Eye },
  {
    key: "control",
    label: "Take Control",
    description: "Mouse and keyboard control, within limits",
    icon: Hand,
  },
  {
    key: "pause",
    label: "Pause Control",
    description: "Temporarily freeze screen view",
    icon: Pause,
  },
  {
    key: "freeze",
    label: "Freeze Screen",
    description: "Lock current screen state",
    icon: Snowflake,
  },
];

export function AMScreenControl() {
  const { sessions, session, control, isLoading } = useActiveSession();
  const { data: accessModes = [] } = useAccessModes();
  const updateControl = useUpdateControlState();
  const updateAccessMode = useUpdateAccessMode();

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingBlock />
      </div>
    );
  }

  if (!session) {
    return (
<div className="space-y-6 p-6">
        <ScreenHeader title="Screen Control" subtitle="Remote control permissions and access modes" />
        <EmptyState
          title="No session to control"
          description="Screen control activates once a session is live."
        />
      </div>
    );
  }

  const toggles = [
    { key: "cursor_control" as const, label: "Cursor Control", icon: MousePointer2 },
    { key: "keyboard_control" as const, label: "Keyboard Control", icon: Keyboard },
    { key: "window_specific" as const, label: "Window-Specific Access", icon: Maximize },
    { key: "resolution_lock" as const, label: "Resolution Lock", icon: Lock },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Screen Control"
          subtitle="Remote control permissions and access modes"
          actions={<SessionPicker sessions={sessions} value={session.id} />}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Control Mode</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {MODES.map((mode) => {
              const active = control?.control_mode === mode.key;
              const Icon = mode.icon;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() =>
                    updateControl.mutate({
                      sessionId: session.id,
                      patch: { control_mode: mode.key, is_paused: mode.key === "pause" },
                    })
                  }
                  className={cn(
                    "rounded-lg border p-4 text-center transition-colors",
                    active
                      ? "border-primary bg-primary/10 glow-ring"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <Icon className={cn("mx-auto mb-2 h-6 w-6", active && "text-primary")} />
                  <p className="text-sm font-medium">{mode.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{mode.description}</p>
                </button>
              );
            })}
            <button
              type="button"
              disabled={!control?.is_paused || updateControl.isPending}
              onClick={() =>
                updateControl.mutate({
                  sessionId: session.id,
                  patch: { control_mode: "view", is_paused: false },
                })
              }
              className={cn(
                "rounded-lg border p-4 text-center transition-colors",
                control?.is_paused
                  ? "border-success/50 hover:border-success"
                  : "border-border opacity-60",
              )}
            >
              <Play
                className={cn("mx-auto mb-2 h-6 w-6", control?.is_paused && "text-success")}
              />
              <p className="text-sm font-medium">Resume</p>
              <p className="mt-1 text-xs text-muted-foreground">Continue the paused session</p>
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Restrictions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div
              className={cn(
                "rounded-lg border p-3",
                control?.window_specific
                  ? "border-success/30 bg-success/10"
                  : "border-warning/30 bg-warning/10",
              )}
            >
              <p
                className={cn(
                  "text-sm font-medium",
                  control?.window_specific ? "text-success" : "text-warning",
                )}
              >
                {control?.window_specific ? "NO FULL SYSTEM ACCESS" : "FULL DESKTOP VISIBLE"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {control?.window_specific
                  ? "Window-specific access only"
                  : "Enable window-specific access to restrict the view"}
              </p>
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
              <p className="text-sm font-medium text-warning">LATENCY OPTIMIZATION</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Streaming at {session.latency_ms} ms · {session.frame_rate} fps
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-3",
                control?.resolution_lock
                  ? "border-info/30 bg-info/10"
                  : "border-border bg-muted/40",
              )}
            >
              <p
                className={cn(
                  "text-sm font-medium",
                  control?.resolution_lock ? "text-info" : "text-muted-foreground",
                )}
              >
                {control?.resolution_lock ? "RESOLUTION LOCKED" : "RESOLUTION UNLOCKED"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Target display {session.resolution}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Granular Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {toggles.map((t) => {
                const Icon = t.icon;
                return (
                  <div
                    key={t.key}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/40 p-3"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <Icon className="h-4 w-4 text-primary" />
                      {t.label}
                    </span>
                    <Switch
                      checked={Boolean(control?.[t.key])}
                      onCheckedChange={(v) =>
                        updateControl.mutate({ sessionId: session.id, patch: { [t.key]: v } })
                      }
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Access Modes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {accessModes.map((mode) => {
                const Icon = iconFor(mode.icon);
                return (
                  <div
                    key={mode.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-4 w-4 text-primary" />
                      <div>
                        <p className="text-sm font-medium">{mode.label}</p>
                        <p className="text-xs text-muted-foreground">{mode.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={mode.is_active}
                      onCheckedChange={(v) => updateAccessMode.mutate({ id: mode.id, isActive: v })}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <CodeChip>{session.session_code}</CodeChip>
              <CodeChip>{session.resolution}</CodeChip>
              <CodeChip>{session.frame_rate} fps</CodeChip>
              <CodeChip>{control?.control_mode ?? "view"} mode</CodeChip>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() =>
                updateControl.mutate({
                  sessionId: session.id,
                  patch: {
                    control_mode: "view",
                    cursor_control: false,
                    keyboard_control: false,
                  },
                })
              }
            >
              Revoke control
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMScreenControl;
