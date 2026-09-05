import type { Database } from "@/integrations/supabase/types";

export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "follow_up"
  | "negotiation"
  | "won"
  | "lost"
  | "spam";

export type LeadSourceType =
  | "website"
  | "seo"
  | "social"
  | "ads"
  | "marketplace"
  | "referral"
  | "manual"
  | "api"
  | "whatsapp";

export type LeadPriority = "critical" | "high" | "medium" | "low";
export type LeadTemperature = "hot" | "warm" | "cold";
export type AgentStatus = "online" | "busy" | "offline";

type Tables = Database["public"]["Tables"];

export type Lead = Tables["leads"]["Row"];
export type LeadInsert = Tables["leads"]["Insert"];
export type LeadUpdate = Tables["leads"]["Update"];
export type Agent = Tables["lead_agents"]["Row"];
export type LeadSourceRow = Tables["lead_sources"]["Row"];
export type LeadNote = Tables["lead_notes"]["Row"];
export type LeadCommunication = Tables["lead_communications"]["Row"];
export type LeadFollowUp = Tables["lead_follow_ups"]["Row"];
export type LeadEscalation = Tables["lead_escalations"]["Row"];
export type LeadAlert = Tables["lead_alerts"]["Row"];
export type RoutingRule = Tables["lead_routing_rules"]["Row"];
export type AutomationRule = Tables["lead_automation_rules"]["Row"];
export type Integration = Tables["lead_integrations"]["Row"];
export type IntegrationEvent = Tables["lead_integration_events"]["Row"];
export type LeadSetting = Tables["lead_settings"]["Row"];
export type AuditLog = Tables["lead_audit_logs"]["Row"];

export const PIPELINE_STAGES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "interested", label: "Interested" },
  { id: "follow_up", label: "Follow-Up" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Interested",
  follow_up: "Follow-Up",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  spam: "Spam / Rejected",
};
