import { supabase } from "@/integrations/supabase/client";
import type {
  AccessModeRow,
  Agent,
  AiSuggestion,
  Approval,
  AssistSession,
  ChatMessage,
  ControlState,
  EmergencyStop,
  EndUser,
  FileTransfer,
  PrivacyControl,
  SessionRequest,
  SessionWindow,
  SettingRow,
} from "./types";

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
}

const SESSION_SELECT =
  "*, end_user:assist_end_users(*), agent:assist_agents(*)";

export async function fetchSessions(): Promise<AssistSession[]> {
  return unwrap<AssistSession[]>(
    (await supabase
      .from("assist_sessions")
      .select(SESSION_SELECT)
      .order("created_at", { ascending: false })) as never,
  );
}

export async function fetchAgents(): Promise<Agent[]> {
  return unwrap<Agent[]>(
    (await supabase.from("assist_agents").select("*").order("agent_code")) as never,
  );
}

export async function fetchEndUsers(): Promise<EndUser[]> {
  return unwrap<EndUser[]>(
    (await supabase.from("assist_end_users").select("*").order("user_code")) as never,
  );
}

export async function fetchRequests(): Promise<SessionRequest[]> {
  return unwrap<SessionRequest[]>(
    (await supabase
      .from("assist_session_requests")
      .select("*, end_user:assist_end_users(*)")
      .order("created_at", { ascending: false })) as never,
  );
}

export async function fetchApprovals(): Promise<Approval[]> {
  return unwrap<Approval[]>(
    (await supabase
      .from("assist_approvals")
      .select(
        "*, session:assist_sessions(id, session_code), agent:assist_agents(*), end_user:assist_end_users(*)",
      )
      .order("submitted_at", { ascending: false })) as never,
  );
}

export async function fetchChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return unwrap<ChatMessage[]>(
    (await supabase
      .from("assist_chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at")) as never,
  );
}

export async function fetchTransfers(): Promise<FileTransfer[]> {
  return unwrap<FileTransfer[]>(
    (await supabase
      .from("assist_file_transfers")
      .select("*")
      .order("created_at", { ascending: false })) as never,
  );
}

export async function fetchWindows(sessionId: string): Promise<SessionWindow[]> {
  return unwrap<SessionWindow[]>(
    (await supabase
      .from("assist_session_windows")
      .select("*")
      .eq("session_id", sessionId)
      .order("sort_order")) as never,
  );
}

export async function fetchSuggestions(): Promise<AiSuggestion[]> {
  return unwrap<AiSuggestion[]>(
    (await supabase
      .from("assist_ai_suggestions")
      .select("*")
      .order("created_at", { ascending: false })) as never,
  );
}

export async function fetchEmergencyStops(): Promise<EmergencyStop[]> {
  return unwrap<EmergencyStop[]>(
    (await supabase
      .from("assist_emergency_stops")
      .select("*")
      .order("created_at", { ascending: false })) as never,
  );
}

export async function fetchPrivacyControls(): Promise<PrivacyControl[]> {
  return unwrap<PrivacyControl[]>(
    (await supabase.from("assist_privacy_controls").select("*").order("sort_order")) as never,
  );
}

export async function fetchAccessModes(): Promise<AccessModeRow[]> {
  return unwrap<AccessModeRow[]>(
    (await supabase.from("assist_access_modes").select("*").order("sort_order")) as never,
  );
}

export async function fetchSettings(): Promise<SettingRow[]> {
  return unwrap<SettingRow[]>(
    (await supabase
      .from("assist_settings")
      .select("*")
      .order("section")
      .order("sort_order")) as never,
  );
}

export async function fetchControlStates(): Promise<ControlState[]> {
  return unwrap<ControlState[]>(
    (await supabase.from("assist_control_state").select("*")) as never,
  );
}

/* ------------------------------- mutations ------------------------------- */

function mutate(res: { error: { message: string } | null }) {
  if (res.error) throw new Error(res.error.message);
}

function randomCode(prefix: string, length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${out}`;
}

export interface CreateAssistInput {
  endUserId: string;
  agentId: string;
  assistType: string;
  accessMode: string;
  purpose: string;
  durationMinutes: number;
  permissions: string[];
  aiAssist: boolean;
}

export async function createAssistSession(input: CreateAssistInput) {
  const sessionCode = randomCode("SVL");
  const inserted = await supabase
    .from("assist_sessions")
    .insert({
      session_code: sessionCode,
      end_user_id: input.endUserId,
      agent_id: input.agentId,
      assist_type: input.assistType,
      access_mode: input.accessMode,
      status: "pending",
      purpose: input.purpose,
      ai_involved: input.aiAssist,
      permissions: input.permissions.length ? input.permissions : ["screen_view"],
      risk_level:
        input.accessMode === "control_full"
          ? "high"
          : input.accessMode === "control_limited"
            ? "medium"
            : "low",
    } as never)
    .select("id, session_code")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  const session = inserted.data as { id: string; session_code: string };

  mutate(
    await supabase.from("assist_approvals").insert({
      approval_code: randomCode("APR", 4),
      session_id: session.id,
      agent_id: input.agentId,
      end_user_id: input.endUserId,
      assist_type: input.assistType,
      scope:
        input.accessMode === "control_full"
          ? "Full Control"
          : input.accessMode === "control_limited"
            ? "Limited Control"
            : "View + Chat",
      awaiting_role: input.accessMode.startsWith("control") ? "Boss Owner" : "Manager",
      expires_at: new Date(Date.now() + input.durationMinutes * 60_000).toISOString(),
    } as never),
  );

  mutate(
    await supabase.from("assist_control_state").insert({
      session_id: session.id,
      control_mode: "view",
    } as never),
  );

  return session;
}

export async function decideRequest(input: {
  id: string;
  decision: "approved" | "rejected";
  note?: string | undefined;
}) {
  mutate(
    await supabase
      .from("assist_session_requests")
      .update({
        status: input.decision,
        review_note: input.note ?? null,
        reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", input.id),
  );
}

export async function decideApproval(input: {
  id: string;
  sessionId?: string | null | undefined;
  decision: "approved" | "rejected";
  note?: string | undefined;
}) {
  mutate(
    await supabase
      .from("assist_approvals")
      .update({
        status: input.decision,
        decided_at: new Date().toISOString(),
        decision_note: input.note ?? null,
      } as never)
      .eq("id", input.id),
  );

  if (input.sessionId) {
    mutate(
      await supabase
        .from("assist_sessions")
        .update(
          input.decision === "approved"
            ? { status: "active", started_at: new Date().toISOString() }
            : { status: "blocked", ended_at: new Date().toISOString(), end_reason: "Approval rejected" },
        )
        .eq("id", input.sessionId),
    );
  }
}

export async function endSession(input: { id: string; reason: string; emergency?: boolean }) {
  const session = await supabase
    .from("assist_sessions")
    .select("session_code")
    .eq("id", input.id)
    .single();
  if (session.error) throw new Error(session.error.message);

  mutate(
    await supabase
      .from("assist_sessions")
      .update({
        status: input.emergency ? "terminated" : "completed",
        ended_at: new Date().toISOString(),
        end_reason: input.reason,
      } as never)
      .eq("id", input.id),
  );

  if (input.emergency) {
    mutate(
      await supabase.from("assist_emergency_stops").insert({
        stop_code: randomCode("STOP", 4),
        session_code: (session.data as { session_code: string }).session_code,
        reason: input.reason,
        stopped_by: "Assist Manager",
        stop_type: "force_single",
      } as never),
    );
  }
}

export async function stopAllSessions(reason: string) {
  const active = await supabase
    .from("assist_sessions")
    .select("id, session_code")
    .in("status", ["active", "paused", "pending"]);
  if (active.error) throw new Error(active.error.message);
  const rows = (active.data ?? []) as { id: string; session_code: string }[];

  if (rows.length) {
    mutate(
      await supabase
        .from("assist_sessions")
        .update({
          status: "terminated",
          ended_at: new Date().toISOString(),
          end_reason: `FORCE_END_ALL: ${reason}`,
        } as never)
        .in(
          "id",
          rows.map((r) => r.id),
        ),
    );

    mutate(
      await supabase.from("assist_emergency_stops").insert(
        rows.map((r) => ({
          stop_code: randomCode("STOP", 5),
          session_code: r.session_code,
          reason,
          stopped_by: "Assist Manager",
          stop_type: "force_all",
        })) as never,
      ),
    );
  }
  return rows.length;
}

export async function pauseResumeSession(input: { id: string; pause: boolean }) {
  mutate(
    await supabase
      .from("assist_sessions")
      .update({ status: input.pause ? "paused" : "active" } as never)
      .eq("id", input.id),
  );
}

export async function sendChatMessage(input: {
  sessionId: string;
  body: string;
  sender?: "agent" | "user" | "ai";
}) {
  mutate(
    await supabase.from("assist_chat_messages").insert({
      session_id: input.sessionId,
      sender: input.sender ?? "agent",
      body: input.body,
    } as never),
  );
}

export async function updateControlState(input: {
  sessionId: string;
  patch: Partial<Omit<ControlState, "id" | "session_id">>;
}) {
  mutate(
    await supabase
      .from("assist_control_state")
      .update(input.patch as never)
      .eq("session_id", input.sessionId),
  );
}

export async function updatePrivacyControl(input: { id: string; enabled: boolean }) {
  mutate(
    await supabase
      .from("assist_privacy_controls")
      .update({ enabled: input.enabled } as never)
      .eq("id", input.id),
  );
}

export async function updateAccessMode(input: { id: string; isActive: boolean }) {
  mutate(
    await supabase
      .from("assist_access_modes")
      .update({ is_active: input.isActive } as never)
      .eq("id", input.id),
  );
}

export async function updateSetting(input: { id: string; value: string }) {
  mutate(
    await supabase
      .from("assist_settings")
      .update({ value: input.value } as never)
      .eq("id", input.id),
  );
}

export async function updateWindowVisibility(input: {
  sessionId: string;
  windowId: string;
}) {
  mutate(
    await supabase
      .from("assist_session_windows")
      .update({ is_visible: false } as never)
      .eq("session_id", input.sessionId),
  );
  mutate(
    await supabase
      .from("assist_session_windows")
      .update({ is_visible: true } as never)
      .eq("id", input.windowId),
  );
}

export async function decideSuggestion(input: {
  id: string;
  status: "accepted" | "dismissed";
}) {
  mutate(
    await supabase
      .from("assist_ai_suggestions")
      .update({ status: input.status } as never)
      .eq("id", input.id),
  );
}

export async function createTransfer(input: {
  sessionId: string;
  fileName: string;
  sizeBytes: number;
  direction: "send" | "receive";
}) {
  mutate(
    await supabase.from("assist_file_transfers").insert({
      transfer_code: randomCode("FT", 4),
      session_id: input.sessionId,
      file_name: input.fileName,
      size_bytes: input.sizeBytes,
      direction: input.direction,
      status: "pending",
      progress: 0,
    } as never),
  );
}

export async function updateTransferStatus(input: {
  id: string;
  status: FileTransfer["status"];
  progress: number;
}) {
  mutate(
    await supabase
      .from("assist_file_transfers")
      .update({ status: input.status, progress: input.progress } as never)
      .eq("id", input.id),
  );
}