import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useControlStates, useSessions } from "@/lib/assist-manager/hooks";
import type { AssistSession, ControlState } from "@/lib/assist-manager/types";
import { useAM } from "./am-context";

/** Resolves the session the live tools operate on: explicit selection, else first live session. */
export function useActiveSession(): {
  sessions: AssistSession[];
  session: AssistSession | undefined;
  control: ControlState | undefined;
  isLoading: boolean;
} {
  const { selectedSessionId } = useAM();
  const { data: sessions = [], isLoading } = useSessions();
  const { data: controls = [] } = useControlStates();

  const live = sessions.filter((s) => s.status === "active" || s.status === "paused");
  const session =
    live.find((s) => s.id === selectedSessionId) ??
    sessions.find((s) => s.id === selectedSessionId) ??
    live[0];

  return {
    sessions: live,
    session,
    control: controls.find((c) => c.session_id === session?.id),
    isLoading,
  };
}

export function SessionPicker({
  sessions,
  value,
}: {
  sessions: AssistSession[];
  value: string | undefined;
}) {
  const { setSelectedSessionId } = useAM();
  if (!sessions.length) return null;
  return (
    <Select value={value ?? ""} onValueChange={(v) => setSelectedSessionId(v)}>
      <SelectTrigger className="w-[240px]">
        <SelectValue placeholder="Select session" />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.session_code} · {s.end_user?.user_code ?? "—"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
