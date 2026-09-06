/**
 * LIVE ASSIST
 * Real-time remote assist view for the selected session.
 */

import {
  Activity,
  Brain,
  Camera,
  Maximize2,
  MessageSquare,
  Monitor,
  MousePointer,
  Pause,
  Play,
  Shield,
  Square,
  Keyboard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  useEndSession,
  usePauseResume,
  useSessionWindows,
  useUpdateControlState,
} from "@/lib/assist-manager/hooks";
import {
  ACCESS_MODE_LABEL,
  CodeChip,
  EmptyState,
  LoadingBlock,
  RiskPill,
  ScreenHeader,
  StatusPill,
  formatDuration,
} from "../am-ui";
import { SessionPicker, useActiveSession } from "../am-session";
import { useAM } from "../am-context";

export function AMLiveAssist() {
  const { sessions, session, control, isLoading } = useActiveSession();
  const { data: windows = [] } = useSessionWindows(session?.id);
  const pauseResume = usePauseResume();
  const endSession = useEndSession();
  const updateControl = useUpdateControlState();
  const { setSection } = useAM();

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
        <ScreenHeader title="Live Assist" subtitle="Real-time assist stream and session controls" />
        <EmptyState
          title="No live session"
          description="Approve a pending session to start assisting."
        />
      </div>
    );
  }

  const visibleWindow =
    windows.find((w) => w.is_visible)?.title ?? session.end_user?.active_window ?? "Full desktop";

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Live Assist"
          subtitle={`Session ${session.session_code} · ${session.end_user?.device ?? "device"}`}
          actions={
            <>
              <SessionPicker sessions={sessions} value={session.id} />
              <StatusPill status={session.status} />
            </>
          }
        />

        <Card className="overflow-hidden">
          <div className="relative flex aspect-video items-center justify-center bg-muted/40 panel-grid">
            <div className="text-center">
              <Monitor className="mx-auto mb-3 h-14 w-14 text-primary" />
              <p className="font-medium">{visibleWindow}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {session.resolution} · {session.frame_rate} fps · {session.latency_ms} ms latency
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Stream renders here once the assist relay is connected.
              </p>
            </div>
            <div className="absolute left-4 top-4 flex flex-wrap gap-2">
              <CodeChip>{ACCESS_MODE_LABEL[session.access_mode] ?? session.access_mode}</CodeChip>
              <RiskPill risk={session.risk_level} />
            </div>
            <div className="absolute right-4 top-4">
              <Button size="sm" variant="secondary" onClick={() => setSection("screen_control")}>
                <Maximize2 className="mr-1 h-4 w-4" />
                Controls
              </Button>
            </div>
          </div>

          <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  pauseResume.mutate({ id: session.id, pause: session.status === "active" })
                }
              >
                {session.status === "active" ? (
                  <>
                    <Pause className="mr-1 h-4 w-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-1 h-4 w-4" /> Resume
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  session.id &&
                  updateControl.mutate({
                    sessionId: session.id,
                    patch: { cursor_control: !control?.cursor_control },
                  })
                }
              >
                <MousePointer className="mr-1 h-4 w-4" />
                Cursor {control?.cursor_control ? "on" : "off"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  updateControl.mutate({
                    sessionId: session.id,
                    patch: { keyboard_control: !control?.keyboard_control },
                  })
                }
              >
                <Keyboard className="mr-1 h-4 w-4" />
                Keyboard {control?.keyboard_control ? "on" : "off"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSection("chat_voice")}>
                <MessageSquare className="mr-1 h-4 w-4" />
                Chat
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.info("Screenshots are blocked by privacy controls")}
              >
                <Camera className="mr-1 h-4 w-4" />
                Snapshot
              </Button>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                endSession.mutate({ id: session.id, reason: "Ended by Assist Manager" })
              }
            >
              <Square className="mr-1 h-4 w-4" />
              End Session
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-primary" /> Session Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Duration" value={formatDuration(session.started_at)} />
              <Row label="Actions" value={String(session.actions_count)} />
              <Row label="Latency" value={`${session.latency_ms} ms`} />
              <Row label="Frame rate" value={`${session.frame_rate} fps`} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-success" /> Permissions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {session.permissions.map((p) => (
                  <CodeChip key={p}>{p.replace(/_/g, " ")}</CodeChip>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {session.restrictions.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 text-xs text-destructive"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4 text-info" /> AI Layer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="AI involved" value={session.ai_involved ? "Yes" : "No"} />
              <Row label="Trust score" value={`${session.ai_score}%`} />
              <Row label="Auto translate" value={control?.auto_translate ? "On" : "Off"} />
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => setSection("ai_assist_layer")}
              >
                Open AI layer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="code-chip">{value}</span>
    </div>
  );
}

export default AMLiveAssist;
