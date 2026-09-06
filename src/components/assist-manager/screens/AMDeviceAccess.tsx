/**
 * DEVICE ACCESS
 * Access modes and visible-window control for the live session.
 */

import { AppWindow, CheckCircle2, Laptop, Lock, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  useAccessModes,
  useSessionWindows,
  useUpdateAccessMode,
  useUpdateWindowVisibility,
} from "@/lib/assist-manager/hooks";
import {
  CodeChip,
  EmptyState,
  LoadingBlock,
  ScreenHeader,
  iconFor,
  titleCase,
} from "../am-ui";
import { SessionPicker, useActiveSession } from "../am-session";

export function AMDeviceAccess() {
  const { sessions, session, isLoading } = useActiveSession();
  const { data: modes = [], isLoading: modesLoading } = useAccessModes();
  const { data: windows = [] } = useSessionWindows(session?.id);
  const updateMode = useUpdateAccessMode();
  const setVisibleWindow = useUpdateWindowVisibility(session?.id);

  return (
    <ScrollArea className="h-full">
      <div className="space-y-6 p-6">
        <ScreenHeader
          title="Device Access"
          subtitle="Control what parts of the device can be accessed"
          actions={<SessionPicker sessions={sessions} value={session?.id} />}
        />

        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Laptop className="h-5 w-5" />
              Current Session Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <LoadingBlock rows={2} />
            ) : !session ? (
              <EmptyState
                title="No live session"
                description="Start or approve a session to inspect device access."
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Session</p>
                    <div className="mt-1">
                      <CodeChip>{session.session_code}</CodeChip>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Device</p>
                    <p className="text-sm font-medium">
                      {session.end_user?.device ?? "—"}
                      {session.end_user?.operating_system
                        ? ` · ${session.end_user.operating_system}`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">User</p>
                    <p className="code-chip text-sm">{session.end_user?.user_code ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Active Window</p>
                    <p className="text-sm font-medium">
                      {windows.find((w) => w.is_visible)?.title ??
                        session.end_user?.active_window ??
                        "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Permissions</p>
                    <div className="flex flex-wrap gap-2">
                      {session.permissions.map((p) => (
                        <Badge key={p} variant="default" className="text-xs">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {titleCase(p)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-muted-foreground">Restrictions</p>
                    <div className="flex flex-wrap gap-2">
                      {session.restrictions.map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs">
                          <Lock className="mr-1 h-3 w-3" />
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5" />
              Access Modes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {modesLoading ? (
              <LoadingBlock rows={2} />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {modes.map((mode) => {
                  const Icon = iconFor(mode.icon);
                  return (
                    <div
                      key={mode.id}
                      className={`flex items-center justify-between rounded-lg p-4 ${
                        mode.is_active
                          ? "border border-success/30 bg-success/10"
                          : "bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                            mode.is_active ? "bg-success/20" : "bg-muted"
                          }`}
                        >
                          <Icon
                            className={`h-5 w-5 ${
                              mode.is_active ? "text-success" : "text-muted-foreground"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{mode.label}</p>
                          <p className="text-xs text-muted-foreground">{mode.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={mode.is_active}
                        disabled={updateMode.isPending}
                        onCheckedChange={(checked) =>
                          updateMode.mutate({ id: mode.id, isActive: checked })
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Visible Windows</CardTitle>
          </CardHeader>
          <CardContent>
            {!session ? (
              <EmptyState title="No live session" description="Select a session to manage windows." />
            ) : windows.length === 0 ? (
              <EmptyState
                title="No windows reported"
                description="The endpoint has not published any window list for this session."
              />
            ) : (
              <div className="space-y-2">
                {windows.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    disabled={setVisibleWindow.isPending}
                    onClick={() =>
                      setVisibleWindow.mutate({ sessionId: session.id, windowId: w.id })
                    }
                    className={`flex w-full items-center justify-between rounded-lg p-3 text-left transition-colors ${
                      w.is_visible
                        ? "border border-primary/30 bg-primary/10"
                        : "bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AppWindow className="h-4 w-4" />
                      <span className="text-sm">{w.title}</span>
                    </div>
                    <Badge variant={w.is_visible ? "default" : "secondary"}>
                      {w.is_visible ? "Active" : "Hidden"}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-success/40 bg-success/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-success">Restricted Access Mode</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Full system access is not allowed by default. The agent can only view the active
                  window. All other windows, background processes and system areas stay hidden.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

export default AMDeviceAccess;
