import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as api from "@/lib/assist-manager/api";
import { captureWindowWithBlueMask, recordMaskedStream, type WindowCapture } from "@/lib/assist-manager/capture";
import { useActiveSession } from "./am-session";
import {
  AssistRealtimeContext,
  type AssistControlIntent,
  type AssistRealtimeValue,
} from "./assist-realtime-context";

const MAX_CONTROL_MESSAGE_BYTES = 2048;

function signalingUrl(sessionId: string): string {
  const configured = import.meta.env.VITE_ASSIST_SIGNALING_URL?.trim();
  if (!configured) throw new Error("Assist signaling is not configured for this deployment.");
  const url = new URL(`/assist/${sessionId}`, configured);
  const allowedProtocol =
    url.protocol === "wss:" ||
    (url.protocol === "ws:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
  if (!allowedProtocol) throw new Error("Assist signaling requires a secure WSS connection.");
  return url.toString();
}

export function AssistRealtimeProvider({ children }: { children: ReactNode }) {
  const { session } = useActiveSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<RTCPeerConnectionState | "disconnected">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [lastControlIntent, setLastControlIntent] = useState<string | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const captureRef = useRef<WindowCapture | null>(null);
  const recorderRef = useRef<ReturnType<typeof recordMaskedStream> | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const outgoingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const readyToSignalCandidatesRef = useRef(false);
  const stoppingRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (authError) {
        console.error("[assist-webrtc] could not resolve the signed-in account", authError);
        return;
      }
      if (mounted) setUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const stopConnection = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    const capture = captureRef.current;
    captureRef.current = null;
    const socket = socketRef.current;
    socketRef.current = null;
    const peer = peerRef.current;
    peerRef.current = null;
    dataChannelRef.current?.close();
    dataChannelRef.current = null;
    peer?.close();
    if (socket && socket.readyState < WebSocket.CLOSING) {
      socket.close(1000, "Assist connection stopped.");
    }
    try {
      if (recorder) await recorder.stop();
    } catch (recordingError) {
      const message =
        recordingError instanceof Error ? recordingError.message : "The session recording failed.";
      console.error("[assist-webrtc] failed to save the recording", recordingError);
      setError(message);
      toast.error(message);
    } finally {
      capture?.stop();
      setLocalStream(null);
      setRemoteStream(null);
      setConnectionState("disconnected");
      stoppingRef.current = false;
    }
  }, []);

  const stopRef = useRef(stopConnection);
  stopRef.current = stopConnection;
  useEffect(
    () => () => {
      void stopRef.current();
    },
    [session?.id],
  );

  const startConnection = useCallback(
    async (targetCapture: WindowCapture | null) => {
      const activeSession = sessionRef.current;
      if (!activeSession || !["active", "paused"].includes(activeSession.status)) {
        targetCapture?.stop();
        throw new Error("WebRTC requires an approved, consented live session.");
      }
      await stopConnection();
      stoppingRef.current = false;
      setError(null);
      setConnectionState("connecting");
      pendingCandidatesRef.current = [];
      outgoingCandidatesRef.current = [];
      readyToSignalCandidatesRef.current = false;

      const ticket = await api.getAssistSessionTicket(activeSession.id);
      const peer = new RTCPeerConnection();
      peerRef.current = peer;
      if (targetCapture) {
        captureRef.current = targetCapture;
        setLocalStream(targetCapture.stream);
        for (const track of targetCapture.stream.getVideoTracks()) {
          peer.addTrack(track, targetCapture.stream);
        }
        const recorder = recordMaskedStream(targetCapture.stream, activeSession.id);
        recorderRef.current = recorder;
        targetCapture.stream.getVideoTracks()[0]?.addEventListener(
          "ended",
          () => void stopRef.current(),
          { once: true },
        );
        const controlChannel = peer.createDataChannel("assist-control", { ordered: true });
        dataChannelRef.current = controlChannel;
        controlChannel.onmessage = (event) => {
          if (!sessionRef.current?.control_consent_at || typeof event.data !== "string") return;
          if (new TextEncoder().encode(event.data).byteLength > MAX_CONTROL_MESSAGE_BYTES) return;
          try {
            const message = JSON.parse(event.data) as { kind?: unknown };
            if (["mode", "cursor", "keyboard"].includes(String(message.kind))) {
              setLastControlIntent(String(message.kind));
            }
          } catch (messageError) {
            console.error("[assist-webrtc] ignored an invalid control intent", messageError);
          }
        };
      }
      peer.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) setRemoteStream(stream);
      };
      peer.ondatachannel = (event) => {
        if (event.channel.label !== "assist-control" || targetCapture) {
          event.channel.close();
          return;
        }
        dataChannelRef.current = event.channel;
        event.channel.onmessage = (messageEvent) => {
          if (!sessionRef.current?.control_consent_at || typeof messageEvent.data !== "string") return;
          if (new TextEncoder().encode(messageEvent.data).byteLength > MAX_CONTROL_MESSAGE_BYTES) return;
          try {
            const message = JSON.parse(messageEvent.data) as { kind?: unknown };
            if (["mode", "cursor", "keyboard"].includes(String(message.kind))) {
              setLastControlIntent(String(message.kind));
            }
          } catch (messageError) {
            console.error("[assist-webrtc] ignored an invalid control intent", messageError);
          }
        };
      };
      peer.onicecandidate = (event) => {
        if (!event.candidate) return;
        const candidate = event.candidate.toJSON();
        const socket = socketRef.current;
        if (readyToSignalCandidatesRef.current && socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ice", payload: candidate }));
        } else {
          outgoingCandidatesRef.current.push(candidate);
        }
      };
      peer.onconnectionstatechange = () => {
        setConnectionState(peer.connectionState);
        if (["failed", "closed"].includes(peer.connectionState) && !stoppingRef.current) {
          void stopRef.current();
        }
      };
      const socket = new WebSocket(signalingUrl(activeSession.id), [
        "assist.v1",
        `ticket.${ticket.ticket}`,
      ]);
      socketRef.current = socket;
      socket.onopen = () => {
        if (!targetCapture) return;
        void peer
          .createOffer()
          .then((offer) => peer.setLocalDescription(offer))
          .then(() => {
            if (socket.readyState !== WebSocket.OPEN || !peer.localDescription) return;
            socket.send(
              JSON.stringify({ type: "offer", payload: peer.localDescription.toJSON() }),
            );
            readyToSignalCandidatesRef.current = true;
            for (const candidate of outgoingCandidatesRef.current.splice(0)) {
              socket.send(JSON.stringify({ type: "ice", payload: candidate }));
            }
          })
          .catch((offerError: unknown) => {
            const message = offerError instanceof Error ? offerError.message : "Could not start the video offer.";
            setError(message);
            void stopRef.current();
          });
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        let message: { type?: unknown; payload?: unknown };
        try {
          message = JSON.parse(event.data) as { type?: unknown; payload?: unknown };
        } catch (parseError) {
          console.error("[assist-webrtc] ignored malformed signaling data", parseError);
          return;
        }
        if (message.type === "connected") return;
        if (message.type === "ice" && message.payload && typeof message.payload === "object") {
          const candidate = message.payload as RTCIceCandidateInit;
          if (!peer.remoteDescription) pendingCandidatesRef.current.push(candidate);
          else void peer.addIceCandidate(candidate).catch((candidateError: unknown) => {
            console.error("[assist-webrtc] could not apply ICE candidate", candidateError);
          });
          return;
        }
        const description = message.payload as RTCSessionDescriptionInit | undefined;
        if (message.type === "offer" && !targetCapture && description?.type === "offer") {
          void peer
            .setRemoteDescription(description)
            .then(async () => {
              for (const candidate of pendingCandidatesRef.current.splice(0)) {
                await peer.addIceCandidate(candidate);
              }
              const answer = await peer.createAnswer();
              await peer.setLocalDescription(answer);
              if (socket.readyState !== WebSocket.OPEN || !peer.localDescription) return;
              socket.send(JSON.stringify({ type: "answer", payload: peer.localDescription.toJSON() }));
              readyToSignalCandidatesRef.current = true;
              for (const candidate of outgoingCandidatesRef.current.splice(0)) {
                socket.send(JSON.stringify({ type: "ice", payload: candidate }));
              }
            })
            .catch((answerError: unknown) => {
              const messageText = answerError instanceof Error ? answerError.message : "Could not answer the video offer.";
              setError(messageText);
              void stopRef.current();
            });
        } else if (message.type === "answer" && targetCapture && description?.type === "answer") {
          void peer
            .setRemoteDescription(description)
            .then(async () => {
              for (const candidate of pendingCandidatesRef.current.splice(0)) {
                await peer.addIceCandidate(candidate);
              }
            })
            .catch((answerError: unknown) => {
              console.error("[assist-webrtc] could not apply the video answer", answerError);
              void stopRef.current();
            });
        } else if (message.type === "control" && (message.payload as { kind?: unknown } | undefined)?.kind === "revoked") {
          dataChannelRef.current?.close();
          dataChannelRef.current = null;
          setLastControlIntent("revoked");
        } else if (["control", "control_ack"].includes(String(message.type)) && targetCapture) {
          setLastControlIntent(String(message.type));
        }
      };
      socket.onerror = () => {
        const message = "The Assist signaling connection failed.";
        setError(message);
        toast.error(message);
      };
      socket.onclose = (event) => {
        if (event.code !== 1000 && !stoppingRef.current) {
          const message = event.reason || "The Assist signaling connection closed.";
          setError(message);
          toast.error(message);
          void stopRef.current();
        }
      };
    },
    [stopConnection],
  );

  const startMaskedCapture = useCallback(async () => {
    if (!userId || !session || session.target_user_id !== userId) {
      throw new Error("Only the device owner may start window capture.");
    }
    const capture = await captureWindowWithBlueMask();
    try {
      await startConnection(capture);
    } catch (captureError) {
      await stopConnection();
      capture.stop();
      throw captureError;
    }
  }, [session, startConnection, stopConnection, userId]);

  const connectViewer = useCallback(async () => {
    if (!userId || !session || session.target_user_id === userId) {
      throw new Error("A signed-in Assist participant is required to view the session.");
    }
    try {
      await startConnection(null);
    } catch (connectError) {
      await stopConnection();
      throw connectError;
    }
  }, [session, startConnection, stopConnection, userId]);

  const sendControlIntent = useCallback((intent: AssistControlIntent) => {
    const channel = dataChannelRef.current;
    if (!sessionRef.current?.control_consent_at) {
      throw new Error("The target has not enabled Allow Control.");
    }
    if (!channel || channel.readyState !== "open") {
      throw new Error("The session DataChannel is not connected.");
    }
    const message = JSON.stringify(intent);
    if (new TextEncoder().encode(message).byteLength > MAX_CONTROL_MESSAGE_BYTES) {
      throw new Error("The control message exceeds its size limit.");
    }
    channel.send(message);
  }, []);

  const value = useMemo<AssistRealtimeValue>(
    () => ({
      session,
      identityReady: Boolean(userId),
      isTarget: Boolean(userId && session?.target_user_id === userId),
      isConnected: connectionState === "connected",
      connectionState,
      error,
      localStream,
      remoteStream,
      lastControlIntent,
      startMaskedCapture,
      connectViewer,
      stopConnection,
      sendControlIntent,
    }),
    [
      session,
      userId,
      connectionState,
      error,
      localStream,
      remoteStream,
      lastControlIntent,
      startMaskedCapture,
      connectViewer,
      stopConnection,
      sendControlIntent,
    ],
  );

  return <AssistRealtimeContext.Provider value={value}>{children}</AssistRealtimeContext.Provider>;
}
