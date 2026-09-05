import { useQuery } from "@tanstack/react-query";
import { leadApi } from "./api";

export const leadKeys = {
  leads: (filters?: unknown) => ["lm", "leads", filters ?? {}] as const,
  lead: (id: string) => ["lm", "lead", id] as const,
  agents: ["lm", "agents"] as const,
  sources: ["lm", "sources"] as const,
  alerts: ["lm", "alerts"] as const,
  followUps: ["lm", "follow-ups"] as const,
  escalations: ["lm", "escalations"] as const,
  routing: ["lm", "routing"] as const,
  automation: ["lm", "automation"] as const,
  integrations: ["lm", "integrations"] as const,
  integrationEvents: ["lm", "integration-events"] as const,
  settings: ["lm", "settings"] as const,
  audit: ["lm", "audit"] as const,
  notes: (id: string) => ["lm", "notes", id] as const,
  comms: (id: string) => ["lm", "comms", id] as const,
};

export const useLeads = (filters: { status?: string; source?: string; search?: string } = {}) =>
  useQuery({ queryKey: leadKeys.leads(filters), queryFn: () => leadApi.listLeads(filters) });

export const useAgents = () =>
  useQuery({ queryKey: leadKeys.agents, queryFn: () => leadApi.listAgents() });

export const useSources = () =>
  useQuery({ queryKey: leadKeys.sources, queryFn: () => leadApi.listSources() });

export const useAlerts = () =>
  useQuery({ queryKey: leadKeys.alerts, queryFn: () => leadApi.listAlerts() });

export const useFollowUps = () =>
  useQuery({ queryKey: leadKeys.followUps, queryFn: () => leadApi.listFollowUps() });

export const useEscalations = () =>
  useQuery({ queryKey: leadKeys.escalations, queryFn: () => leadApi.listEscalations() });

export const useRoutingRules = () =>
  useQuery({ queryKey: leadKeys.routing, queryFn: () => leadApi.listRoutingRules() });

export const useAutomationRules = () =>
  useQuery({ queryKey: leadKeys.automation, queryFn: () => leadApi.listAutomationRules() });

export const useIntegrations = () =>
  useQuery({ queryKey: leadKeys.integrations, queryFn: () => leadApi.listIntegrations() });

export const useIntegrationEvents = () =>
  useQuery({
    queryKey: leadKeys.integrationEvents,
    queryFn: () => leadApi.listIntegrationEvents(),
  });

export const useSettings = () =>
  useQuery({ queryKey: leadKeys.settings, queryFn: () => leadApi.listSettings() });

export const useAuditLogs = () =>
  useQuery({ queryKey: leadKeys.audit, queryFn: () => leadApi.listAuditLogs() });

export const useLeadNotes = (id: string | null) =>
  useQuery({
    queryKey: leadKeys.notes(id ?? ""),
    queryFn: () => leadApi.listNotes(id as string),
    enabled: !!id,
  });

export const useLeadCommunications = (id: string | null) =>
  useQuery({
    queryKey: leadKeys.comms(id ?? ""),
    queryFn: () => leadApi.listCommunications(id as string),
    enabled: !!id,
  });

export const useAssignments = () =>
  useQuery({ queryKey: ["lm", "assignments"], queryFn: () => leadApi.listAssignments() });

export const useRecentCommunications = () =>
  useQuery({ queryKey: ["lm", "recent-comms"], queryFn: () => leadApi.listRecentCommunications() });

export const useScores = () =>
  useQuery({ queryKey: ["lm", "scores"], queryFn: () => leadApi.listScores() });
