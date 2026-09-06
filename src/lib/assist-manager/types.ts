export type AccessMode =
  | "view_only"
  | "control_limited"
  | "control_full"
  | "file_transfer"
  | "chat_only";

export type SessionStatus =
  | "pending"
  | "active"
  | "paused"
  | "completed"
  | "terminated"
  | "blocked";

export type Priority = "normal" | "high" | "critical";
export type RiskLevel = "low" | "medium" | "high";
export type ControlMode = "view" | "control" | "pause" | "freeze";

export interface Agent {
  id: string;
  agent_code: string;
  display_name: string;
  specialisation: string;
  status: "available" | "in_session" | "offline";
}

export interface EndUser {
  id: string;
  user_code: string;
  role: string;
  device: string;
  operating_system: string;
  active_window: string | null;
}

export interface AssistSession {
  id: string;
  session_code: string;
  assist_type: string;
  access_mode: AccessMode;
  status: SessionStatus;
  purpose: string | null;
  ai_score: number;
  ai_involved: boolean;
  permissions: string[];
  restrictions: string[];
  actions_count: number;
  latency_ms: number;
  resolution: string;
  frame_rate: number;
  risk_level: RiskLevel;
  started_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  created_at: string;
  end_user: EndUser | null;
  agent: Agent | null;
}

export interface SessionRequest {
  id: string;
  request_code: string;
  assist_type: string;
  purpose: string;
  requested_scope: string;
  requested_duration_minutes: number;
  priority: Priority;
  status: "pending" | "approved" | "rejected" | "expired";
  ai_assist_enabled: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  end_user: EndUser | null;
}

export interface Approval {
  id: string;
  approval_code: string;
  assist_type: string;
  scope: string;
  awaiting_role: string;
  status: "pending" | "approved" | "rejected" | "expired";
  submitted_at: string;
  expires_at: string;
  decided_at: string | null;
  decision_note: string | null;
  session: { id: string; session_code: string } | null;
  agent: Agent | null;
  end_user: EndUser | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender: "agent" | "user" | "ai";
  body: string;
  is_translation: boolean;
  created_at: string;
}

export interface FileTransfer {
  id: string;
  transfer_code: string;
  session_id: string;
  file_name: string;
  size_bytes: number;
  direction: "send" | "receive";
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: number;
  one_time_access: boolean;
  auto_delete: boolean;
  created_at: string;
}

export interface SessionWindow {
  id: string;
  session_id: string;
  title: string;
  is_visible: boolean;
  sort_order: number;
}

export interface AiSuggestion {
  id: string;
  suggestion_code: string;
  session_id: string;
  suggestion_type: "fix" | "issue" | "guide" | "translate" | "summary";
  message: string;
  confidence: number;
  status: "open" | "accepted" | "dismissed";
  created_at: string;
}

export interface EmergencyStop {
  id: string;
  stop_code: string;
  session_code: string;
  reason: string;
  stopped_by: string;
  stop_type: "force_single" | "force_all" | "system";
  created_at: string;
}

export interface PrivacyControl {
  id: string;
  control_key: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
  is_critical: boolean;
  sort_order: number;
}

export interface AccessModeRow {
  id: string;
  mode_key: string;
  label: string;
  description: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
}

export interface SettingRow {
  id: string;
  section: string;
  setting_key: string;
  label: string;
  control_type: "toggle" | "number" | "select";
  value: string;
  options: string[] | null;
  sort_order: number;
  is_locked: boolean;
}

export interface ControlState {
  id: string;
  session_id: string;
  control_mode: ControlMode;
  cursor_control: boolean;
  keyboard_control: boolean;
  window_specific: boolean;
  resolution_lock: boolean;
  is_paused: boolean;
  voice_active: boolean;
  microphone_enabled: boolean;
  speaker_enabled: boolean;
  auto_translate: boolean;
}