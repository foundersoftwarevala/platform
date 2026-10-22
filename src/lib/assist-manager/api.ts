// Compatibility wrappers keep the screens' existing input shapes while every
// database operation executes in a TanStack Server Function.
import * as server from "./functions";
import type { ControlState, FileTransfer } from "./types";
export type { CreateAssistInput, AssistSessionLogs } from "./functions";

export const fetchSessions = () => server.fetchSessions();
export const fetchAgents = () => server.fetchAgents();
export const fetchEndUsers = () => server.fetchEndUsers();
export const fetchRequests = () => server.fetchRequests();
export const fetchApprovals = () => server.fetchApprovals();
export const fetchChatMessages = (sessionId: string) => server.fetchChatMessages({ data: { sessionId } });
export const fetchTransfers = () => server.fetchTransfers();
export const fetchWindows = (sessionId: string) => server.fetchWindows({ data: { sessionId } });
export const fetchSuggestions = () => server.fetchSuggestions();
export const fetchEmergencyStops = () => server.fetchEmergencyStops();
export const fetchPrivacyControls = () => server.fetchPrivacyControls();
export const fetchAccessModes = () => server.fetchAccessModes();
export const fetchSettings = () => server.fetchSettings();
export const fetchControlStates = () => server.fetchControlStates();
export const fetchAssistLogs = (input: { sessionId?: string } = {}) =>
  server.fetchAssistLogs({ data: input });
export const getMyPendingConsents = () => server.getMyPendingConsents();
export const getAssistSessionTicket = (sessionId: string) =>
  server.getAssistSessionTicket({ data: { sessionId } });

export const createAssistSession = (data: server.CreateAssistInput) =>
  server.createAssistSession({ data });
export const decideRequest = (data: {
  id: string;
  decision: "approved" | "rejected";
  note?: string;
}) => server.decideRequest({ data });
export const decideApproval = (data: {
  id: string;
  sessionId?: string | null;
  decision: "approved" | "rejected";
  note?: string;
}) => server.decideApproval({ data });
export const endSession = (data: { id: string; reason: string; emergency?: boolean }) =>
  server.endSession({ data });
export const stopAllSessions = (reason: string) => server.stopAllSessions({ data: reason });
export const pauseResumeSession = (data: { id: string; pause: boolean }) =>
  server.pauseResumeSession({ data });
export const sendChatMessage = (data: {
  sessionId: string;
  body: string;
  sender?: "agent" | "user";
}) => server.sendChatMessage({ data });
export const updateControlState = (data: {
  sessionId: string;
  patch: Partial<Omit<ControlState, "id" | "session_id">>;
}) => server.updateControlState({ data });
export const updatePrivacyControl = (data: { id: string; enabled: boolean }) =>
  server.updatePrivacyControl({ data });
export const updateAccessMode = (data: { id: string; isActive: boolean }) =>
  server.updateAccessMode({ data });
export const updateSetting = (data: { id: string; value: string }) =>
  server.updateSetting({ data });
export const updateWindowVisibility = (data: { sessionId: string; windowId: string }) =>
  server.updateWindowVisibility({ data });
export const decideSuggestion = (data: { id: string; status: "accepted" | "dismissed" }) =>
  server.decideSuggestion({ data });
export const createTransfer = (data: {
  sessionId: string;
  fileName: string;
  sizeBytes: number;
  direction: "send" | "receive";
}) => server.createTransfer({ data });
export const updateTransferStatus = (data: {
  id: string;
  status: FileTransfer["status"];
  progress: number;
}) => server.updateTransferStatus({ data });
export const grantConsent = (data: { sessionId: string; consentHash: string }) =>
  server.grantConsent({ data });
export const denyConsent = (data: { sessionId: string; reason: string }) =>
  server.denyConsent({ data });
export const setControlAllowed = (data: { sessionId: string; allowed: boolean }) =>
  server.setControlAllowed({ data });
