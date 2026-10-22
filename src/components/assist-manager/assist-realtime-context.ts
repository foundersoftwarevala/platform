import { createContext, useContext } from "react";
import type { AssistSession } from "@/lib/assist-manager/types";

export type AssistControlIntent =
  | { kind: "mode"; mode: "view" | "control" | "pause" | "freeze" }
  | { kind: "cursor"; enabled: boolean }
  | { kind: "keyboard"; enabled: boolean };

export type AssistRealtimeValue = {
  session: AssistSession | undefined;
  identityReady: boolean;
  isTarget: boolean;
  isConnected: boolean;
  connectionState: RTCPeerConnectionState | "disconnected";
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  lastControlIntent: string | null;
  startMaskedCapture: () => Promise<void>;
  connectViewer: () => Promise<void>;
  stopConnection: () => Promise<void>;
  sendControlIntent: (intent: AssistControlIntent) => void;
};

export const AssistRealtimeContext = createContext<AssistRealtimeValue | null>(null);

export function useAssistRealtime(): AssistRealtimeValue {
  const value = useContext(AssistRealtimeContext);
  if (!value) throw new Error("useAssistRealtime must be used inside AssistRealtimeProvider.");
  return value;
}
