import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "./api";

export const amKeys = {
  sessions: ["am", "sessions"] as const,
  agents: ["am", "agents"] as const,
  endUsers: ["am", "end-users"] as const,
  requests: ["am", "requests"] as const,
  approvals: ["am", "approvals"] as const,
  chat: (id: string) => ["am", "chat", id] as const,
  transfers: ["am", "transfers"] as const,
  windows: (id: string) => ["am", "windows", id] as const,
  suggestions: ["am", "suggestions"] as const,
  stops: ["am", "stops"] as const,
  privacy: ["am", "privacy"] as const,
  accessModes: ["am", "access-modes"] as const,
  settings: ["am", "settings"] as const,
  controlStates: ["am", "control-states"] as const,
};

export const useSessions = () =>
  useQuery({ queryKey: amKeys.sessions, queryFn: api.fetchSessions });

/** Sessions that are live (active or paused). */
export const useLiveSessions = () => {
  const query = useSessions();
  return {
    ...query,
    data: (query.data ?? []).filter((s) => s.status === "active" || s.status === "paused"),
  };
};
export const useAgents = () => useQuery({ queryKey: amKeys.agents, queryFn: api.fetchAgents });
export const useEndUsers = () =>
  useQuery({ queryKey: amKeys.endUsers, queryFn: api.fetchEndUsers });
export const useRequests = () =>
  useQuery({ queryKey: amKeys.requests, queryFn: api.fetchRequests });
export const useApprovals = () =>
  useQuery({ queryKey: amKeys.approvals, queryFn: api.fetchApprovals });
export const useTransfers = () =>
  useQuery({ queryKey: amKeys.transfers, queryFn: api.fetchTransfers });
export const useSuggestions = () =>
  useQuery({ queryKey: amKeys.suggestions, queryFn: api.fetchSuggestions });
export const useEmergencyStops = () =>
  useQuery({ queryKey: amKeys.stops, queryFn: api.fetchEmergencyStops });
export const usePrivacyControls = () =>
  useQuery({ queryKey: amKeys.privacy, queryFn: api.fetchPrivacyControls });
export const useAccessModes = () =>
  useQuery({ queryKey: amKeys.accessModes, queryFn: api.fetchAccessModes });
export const useSettings = () =>
  useQuery({ queryKey: amKeys.settings, queryFn: api.fetchSettings });
export const useControlStates = () =>
  useQuery({ queryKey: amKeys.controlStates, queryFn: api.fetchControlStates });

export const useChatMessages = (sessionId: string | undefined) =>
  useQuery({
    queryKey: amKeys.chat(sessionId ?? "none"),
    queryFn: () => api.fetchChatMessages(sessionId as string),
    enabled: Boolean(sessionId),
  });

export const useSessionWindows = (sessionId: string | undefined) =>
  useQuery({
    queryKey: amKeys.windows(sessionId ?? "none"),
    queryFn: () => api.fetchWindows(sessionId as string),
    enabled: Boolean(sessionId),
  });

function useAmMutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  options: {
    success: string | ((data: TData) => string);
    invalidate: readonly (readonly unknown[])[];
  },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      options.invalidate.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: [...key] }),
      );
      toast.success(
        typeof options.success === "function" ? options.success(data) : options.success,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export const useCreateAssist = () =>
  useAmMutation(api.createAssistSession, {
    success: (session) => `Assist session ${session.session_code} created and sent for approval`,
    invalidate: [amKeys.sessions, amKeys.approvals, amKeys.controlStates],
  });

export const useDecideRequest = () =>
  useAmMutation(api.decideRequest, {
    success: "Request updated",
    invalidate: [amKeys.requests, amKeys.sessions],
  });

export const useDecideApproval = () =>
  useAmMutation(api.decideApproval, {
    success: "Approval decision recorded",
    invalidate: [amKeys.approvals, amKeys.sessions],
  });

export const useEndSession = () =>
  useAmMutation(api.endSession, {
    success: "Session ended",
    invalidate: [amKeys.sessions, amKeys.stops],
  });

export const useStopAll = () =>
  useAmMutation(api.stopAllSessions, {
    success: (count) => `${count} session(s) terminated`,
    invalidate: [amKeys.sessions, amKeys.stops, amKeys.approvals],
  });

export const usePauseResume = () =>
  useAmMutation(api.pauseResumeSession, {
    success: "Session state updated",
    invalidate: [amKeys.sessions],
  });

export const useSendChat = (sessionId: string | undefined) =>
  useAmMutation(api.sendChatMessage, {
    success: "Message sent",
    invalidate: [amKeys.chat(sessionId ?? "none")],
  });

export const useUpdateControlState = () =>
  useAmMutation(api.updateControlState, {
    success: "Control state updated",
    invalidate: [amKeys.controlStates],
  });

export const useUpdatePrivacyControl = () =>
  useAmMutation(api.updatePrivacyControl, {
    success: "Privacy control updated",
    invalidate: [amKeys.privacy],
  });

export const useUpdateAccessMode = () =>
  useAmMutation(api.updateAccessMode, {
    success: "Access mode updated",
    invalidate: [amKeys.accessModes],
  });

export const useUpdateSetting = () =>
  useAmMutation(api.updateSetting, {
    success: "Setting saved",
    invalidate: [amKeys.settings],
  });

export const useUpdateWindowVisibility = (sessionId: string | undefined) =>
  useAmMutation(api.updateWindowVisibility, {
    success: "Visible window changed",
    invalidate: [amKeys.windows(sessionId ?? "none")],
  });

export const useDecideSuggestion = () =>
  useAmMutation(api.decideSuggestion, {
    success: "Suggestion updated",
    invalidate: [amKeys.suggestions],
  });

export const useCreateTransfer = () =>
  useAmMutation(api.createTransfer, {
    success: "Transfer queued",
    invalidate: [amKeys.transfers],
  });

export const useUpdateTransferStatus = () =>
  useAmMutation(api.updateTransferStatus, {
    success: "Transfer updated",
    invalidate: [amKeys.transfers],
  });