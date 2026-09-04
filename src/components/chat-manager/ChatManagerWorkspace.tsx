import { ManagerWorkspace, type SectionEntry } from "@/components/manager-suite/ManagerWorkspace";

import { chatGroups, chatPrimary } from "./navigation";
import {
  ActivityFeed,
  AiGovernance,
  AuditTrail,
  ChatDashboard,
  HandoffQueue,
  LiveConversations,
  Participants,
  RoleAccessMatrix,
  SecurityPolicy,
} from "./sections";

/**
 * Connect Hub — the central control side of the chat ecosystem. It reads and
 * writes the same conversations, handoffs and permissions the user-side chat
 * app uses, through permission-checked server functions.
 */
const registry: Record<string, SectionEntry> = {
  Dashboard: ChatDashboard,
  "Command Console": ChatDashboard,
  "Live Conversations": LiveConversations,
  "Handoff Queue": HandoffQueue,
  "AI Governance": AiGovernance,
  "Role Access Matrix": RoleAccessMatrix,
  "Security Policy": SecurityPolicy,
  "Audit Trail": AuditTrail,
  Participants,
  Activity: ActivityFeed,
};

export function ChatManagerWorkspace() {
  return (
    <ManagerWorkspace
      primary={chatPrimary}
      groups={chatGroups}
      registry={registry}
      brand="Chat Manager"
      brandMark="CM"
      role="lead"
    />
  );
}
