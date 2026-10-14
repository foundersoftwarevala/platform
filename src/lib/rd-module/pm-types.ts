export interface PMUser {
  id: string;
  code: string;
  product: string;
  license: string;
  region: string;
  tier: string;
  status: "active" | "suspended" | "expired" | "high_risk" | string;
  created_at: string;
  updated_at: string;
}

export interface PMProduct {
  id: string;
  user_code: string;
  product: string;
  version: string;
  modules: string[];
  custom_changes: string;
}

export interface PMLicense {
  id: string;
  user_code: string;
  license_type: string;
  domain: string;
  domain_status: string;
  expiry: string;
  transfer_status: string;
}

export interface PMTicket {
  id: string;
  code: string;
  user_code: string;
  type: string;
  severity: string;
  product: string;
  subject: string;
  status: string;
  opened_at: string;
}

export interface PMIssue {
  id: string;
  code: string;
  build: string;
  summary: string;
  status: string;
  ai_attempts: number;
  last_attempt_at: string | null;
}

export interface PMAssistSession {
  id: string;
  code: string;
  user_code: string;
  mode: string;
  duration_minutes: number;
  status: string;
}

export interface PMPromise {
  id: string;
  code: string;
  action: string;
  task_code: string;
  developer_code: string;
  owner: string;
  type: string;
  deadline: string;
  priority: string;
  status: string;
}

export interface PMUpgrade {
  id: string;
  code: string;
  user_code: string;
  type: string;
  item: string;
  status: string;
  created_at: string;
}

export interface PMRenewal {
  id: string;
  code: string;
  user_code: string;
  product: string;
  expiry: string;
  grace: string;
  status: string;
}

export interface PMUsage {
  id: string;
  user_code: string;
  api_pct: number;
  storage_pct: number;
  ai_calls_pct: number;
  fair_usage_alert: boolean;
}

export interface PMConversation {
  id: string;
  code: string;
  user_code: string;
  topic: string;
  language: string;
  status: string;
  resolution: string;
  created_at: string;
}

export interface PMMessage {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface PMCommunicationLog {
  id: string;
  code: string;
  type: string;
  user_code: string;
  content: string;
  created_at: string;
}

export interface PMAlert {
  id: string;
  code: string;
  type: string;
  message: string;
  severity: string;
  acknowledged: boolean;
  created_at: string;
}

export interface PMSatisfaction {
  id: string;
  user_code: string;
  csat: number;
  feedback: string;
  risk: string;
  ai_prediction: string;
}

export interface PMCompliance {
  id: string;
  user_code: string;
  agreement_accepted: boolean;
  violations: number;
  legal_flag: boolean;
}

export interface PMAuditLog {
  id: string;
  action: string;
  category: string;
  details: string;
  actor: string;
  target: string;
  ip: string;
  status: string;
  created_at: string;
}

export interface PMSetting {
  id: string;
  key: string;
  label: string;
  section: string;
  enabled: boolean;
  locked: boolean;
}

export interface PMHealthMetric {
  id: string;
  code: string;
  name: string;
  status: string;
  value: string;
  trend: string;
  description: string;
}

export interface PMEscalation {
  id: string;
  code: string;
  source: string;
  source_id: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  evidence: string[];
  decision_note: string;
  created_by: string;
  created_at: string;
}

export interface PMQualityAlert {
  id: string;
  code: string;
  pattern: string;
  description: string;
  affected_entity: string;
  entity_type: string;
  severity: string;
  suggested_action: string;
  confidence: number;
  reasoning: string;
  acknowledged: boolean;
  detected_at: string;
}

export interface PMManagerMetric {
  id: string;
  manager_code: string;
  role: string;
  sla_compliance: number;
  escalations_handled: number;
  escalations_pending: number;
  avg_resolution_time: string;
  trend: string;
  status: string;
}

export interface PMDecision {
  id: string;
  code: string;
  type: string;
  subject: string;
  description: string;
  requested_by: string;
  priority: string;
  is_financial: boolean;
  amount: number | null;
  status: string;
  decision_note: string;
  requested_at: string;
}

export interface PMReport {
  id: string;
  code: string;
  name: string;
  type: string;
  size: string;
  generated_at: string;
}
