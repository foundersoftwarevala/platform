import type { Json } from "@/lib/json";

export const AYRA_ROLES = ["SUPER_ADMIN", "FRANCHISE", "AYRA_AGENT"] as const;
export type AyraGrantRole = (typeof AYRA_ROLES)[number];

export const AYRA_PERMISSION_GROUPS = {
  "System Control": [
    ["allow_system_coding", "Allow system coding"],
    ["allow_hardware_control", "Allow hardware control"],
    ["allow_web_portal", "Allow web portal access"],
    ["allow_database_read", "Allow database reads"],
    ["allow_database_write", "Allow database writes"],
    ["allow_deployment", "Allow deployment actions"],
  ],
  "AI Settings": [
    ["allow_ai_chat", "Allow AI chat"],
    ["allow_external_models", "Allow external model providers"],
    ["allow_customer_data_access", "Allow customer data access"],
  ],
  "Agent Brain": [
    ["allow_agent_reports", "Allow agent reports"],
    ["allow_agent_task_write", "Allow task updates"],
    ["allow_automations", "Allow automations"],
  ],
} as const;

export const AYRA_PERMISSION_KEYS = [
  ...AYRA_PERMISSION_GROUPS["System Control"].map(([key]) => key),
  ...AYRA_PERMISSION_GROUPS["AI Settings"].map(([key]) => key),
  ...AYRA_PERMISSION_GROUPS["Agent Brain"].map(([key]) => key),
] as const;
export type AyraGrantPermission = (typeof AYRA_PERMISSION_KEYS)[number];

export function isAyraGrantPermission(value: string): value is AyraGrantPermission {
  return AYRA_PERMISSION_KEYS.some((key) => key === value);
}

export interface AyraGrant {
  roleName: AyraGrantRole;
  permissionKey: AyraGrantPermission;
  isEnabled: boolean;
  updatedAt: string;
}

export interface AyraGrantAudit {
  id: string;
  occurredAt: string;
  actor: string;
  action: string;
  entityId: string | null;
  metadata: Json | null;
}
