import { Button } from "@/components/rd-module/ui/button";
import { usePMAssistSessions } from "@/hooks/rd-module/useProManagerData";
import { useProManagerActions } from "@/hooks/rd-module/useProManagerActions";
import { PMBadge, PMEmpty, PMLoading, PMPanel, PMSection, PMStat, StatusBadge } from "../pm-ui";
import { Handshake, PlayCircle, Timer } from "lucide-react";

const ACTIONS = [
  { status: "active", label: "Start / resume", variant: "outline" as const },
  { status: "paused", label: "Pause", variant: "outline" as const },
  { status: "ended", label: "End session", variant: "outline" as const },
  { status: "escalated", label: "Escalate", variant: "destructive" as const },
];

export const PROPremiumAssist = ({ search = "" }: { search?: string }) => {
  const { data, isLoading } = usePMAssistSessions();
  const { updateAssistSession, run } = useProManagerActions();

  const term = search.trim().toLowerCase();
  const sessions = (data ?? []).filter((row) =>
    term
      ? [row.code, row.user_code, row.mode, row.status].join(" ").toLowerCase().includes(term)
      : true,
  );

  const active = sessions.filter((s) => s.status === "active").length;
  const minutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);

  return (
    <PMSection
      title="Premium assist"
      description="Guided assist sessions with premium accounts. Sessions are supervised and fully audited."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <PMStat label="Sessions" value={sessions.length} icon={Handshake} />
        <PMStat label="Running now" value={active} icon={PlayCircle} tone="success" />
        <PMStat label="Assist minutes" value={minutes} icon={Timer} tone="info" />
      </div>

      <PMPanel title="Sessions">
        {isLoading ? (
          <PMLoading rows={3} />
        ) : sessions.length === 0 ? (
          <PMEmpty message="No assist sessions match this search." />
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2/60 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {session.code} • {session.user_code}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.duration_minutes} minutes
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PMBadge tone="muted">{session.mode}</PMBadge>
                  <StatusBadge value={session.status} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIONS.filter((a) => a.status !== session.status).map((action) => (
                    <Button
                      key={action.status}
                      size="sm"
                      variant={action.variant}
                      onClick={() =>
                        void run(
                          `Session ${action.status}`,
                          updateAssistSession({
                            data: {
                              id: session.id,
                              code: session.code,
                              status: action.status as "active" | "paused" | "ended" | "escalated",
                            },
                          }),
                        )
                      }
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PMPanel>
    </PMSection>
  );
};
