import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SafeAssistSession {
  id: string;
  session_code: string;
  user_code: string;
  agent_code: string;
  status: string;
  user_id: string;
  agent_id: string | null;
  user_consent_given: boolean;
  dual_verified: boolean;
  ai_monitoring_enabled: boolean;
  ai_risk_score: number;
  started_at: string;
  expires_at: string;
}

interface CursorPosition {
  x: number;
  y: number;
  elementPath?: string;
  elementText?: string;
}

interface SafeAssistNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  severity: string;
  read_at: string | null;
  created_at: string;
}

export function useSafeAssist() {
  const { user } = useAuth();
  const [session, setSession] = useState<SafeAssistSession | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notifications, setNotifications] = useState<SafeAssistNotification[]>([]);
  const [userCode, setUserCode] = useState<string>("");
  const [agentCode, setAgentCode] = useState<string>("");
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notificationChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mountedRef = useRef(false);

  // Generate verification codes
  const generateCodes = useCallback(() => {
    // Verification codes come from the cryptographic generator: Math.random()
    // is predictable enough that a code could be guessed from earlier ones.
    const generateCode = () => {
      const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    };
    setUserCode(generateCode());
    setAgentCode(generateCode());
  }, []);

  // Create new session (user side)
  const createSession = useCallback(async () => {
    if (!user) return null;
    setIsLoading(true);

    try {
      generateCodes();

      const { data, error } = await supabase.rpc("create_remote_assist_session" as any, {
        p_user_id: user.id,
      });

      if (error) throw error;

      if (!mountedRef.current) return null;
      const sessionData = data as unknown as SafeAssistSession;
      setSession(sessionData);

      // Subscribe to session updates
      subscribeToSession(sessionData.id);

      toast.success("Safe Assist session created");
      return sessionData;
    } catch (error: any) {
      toast.error("Failed to create session: " + error.message);
      return null;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [user, generateCodes]);

  // Join session (agent side)
  const joinSession = useCallback(
    async (sessionCode: string) => {
      if (!user) return false;
      setIsLoading(true);

      try {
        const { data, error } = await supabase.rpc("join_remote_assist_session", {
          p_session_code: sessionCode,
          p_agent_id: user.id,
        });

        if (error) throw error;

        const result = data as { success: boolean; session_id?: string; error?: string };

        if (!result.success) {
          toast.error(result.error || "Failed to join session");
          return false;
        }

        // Fetch session details
        const { data: sessionData } = await supabase
          .from("safe_assist_sessions")
          .select("*")
          .eq("id", String(result.session_id))
          .single();

        if (sessionData && mountedRef.current) {
          setSession(sessionData as unknown as SafeAssistSession);
          subscribeToSession(sessionData.id);
          generateCodes();
        }

        toast.success("Joined Safe Assist session - waiting for dual verification");
        return true;
      } catch (error: any) {
        toast.error("Failed to join session: " + error.message);
        return false;
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [user, generateCodes],
  );

  // Verify dual connection
  const verifyConnection = useCallback(
    async (enteredCode: string, isAgent: boolean) => {
      if (!session) return false;

      try {
        const { data, error } = await supabase.rpc("verify_safe_assist_connection", {
          p_session_id: session.id,
          p_user_code: isAgent ? enteredCode : "",
          p_agent_code: isAgent ? "" : enteredCode,
          p_is_agent: isAgent,
        });

        if (error) throw error;

        const result = data as { success: boolean; message?: string; error?: string };

        if (result.success) {
          toast.success(result.message || "Verification successful");
          return true;
        } else {
          toast.error(result.error || "Verification failed");
          return false;
        }
      } catch (error: any) {
        toast.error("Verification failed: " + error.message);
        return false;
      }
    },
    [session],
  );

  // Give consent (user side)
  const giveConsent = useCallback(async () => {
    if (!session) return false;

    try {
      const { data, error } = await supabase.rpc("give_remote_assist_consent", {
        p_session_id: session.id,
      });

      if (error) throw error;

      toast.success("Consent given - AI monitoring active");
      return true;
    } catch (error: any) {
      toast.error("Failed to give consent: " + error.message);
      return false;
    }
  }, [session]);

  const cleanupSessionChannels = useCallback(() => {
    const channel = channelRef.current;
    const notificationChannel = notificationChannelRef.current;
    channelRef.current = null;
    notificationChannelRef.current = null;
    if (channel) void supabase.removeChannel(channel);
    if (notificationChannel) void supabase.removeChannel(notificationChannel);
  }, []);

  // End session
  const endSession = useCallback(async () => {
    if (!session) return;

    try {
      await supabase.rpc("end_remote_assist_session", {
        p_session_id: session.id,
      });

      cleanupSessionChannels();

      if (mountedRef.current) {
        setSession(null);
        setIsConnected(false);
        setCursorPosition(null);
      }

      toast.success("Safe Assist session ended");
    } catch (error: any) {
      toast.error("Failed to end session: " + error.message);
    }
  }, [session, cleanupSessionChannels]);

  // Send cursor position (agent side)
  const sendCursorPosition = useCallback(
    (position: CursorPosition) => {
      if (!channelRef.current || !session?.dual_verified) return;

      channelRef.current.send({
        type: "broadcast",
        event: "cursor_move",
        payload: position,
      });
    },
    [session],
  );

  // Subscribe to session updates
  const subscribeToSession = useCallback(
    (sessionId: string) => {
      if (!mountedRef.current) return;
      cleanupSessionChannels();
      const applySessionUpdate = (value: unknown) => {
        if (!mountedRef.current || !value || typeof value !== "object") return;
        const update = value as Partial<SafeAssistSession>;
        if (
          ["ended", "expired", "cancelled", "terminated"].includes(
            update.status?.toLowerCase() ?? "",
          )
        ) {
          cleanupSessionChannels();
          setSession(null);
          setIsConnected(false);
          setCursorPosition(null);
          return;
        }
        setSession((prev) => (prev ? { ...prev, ...update } : null));
      };

      // Session status channel
      const channel = supabase
        .channel(`safe_assist_${sessionId}`)
        .on("broadcast", { event: "cursor_move" }, (payload) => {
          setCursorPosition(payload.payload as CursorPosition);
        })
        .on("broadcast", { event: "session_update" }, (payload) => {
          applySessionUpdate(payload.payload);
        })
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "safe_assist_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            applySessionUpdate(payload.new);
          },
        )
        .on("broadcast", { event: "ai_alert" }, (payload) => {
          const alert = payload.payload as { title: string; message: string; severity: string };
          if (alert.severity === "critical") {
            toast.error(alert.title + ": " + alert.message);
          } else if (alert.severity === "warning") {
            toast.warning(alert.title + ": " + alert.message);
          } else {
            toast.info(alert.title);
          }
        })
        .subscribe((status) => {
          setIsConnected(status === "SUBSCRIBED");
        });

      channelRef.current = channel;

      // Subscribe to notifications (realtime)
      const notificationChannel = supabase
        .channel(`notifications_${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "safe_assist_notifications",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const notification = payload.new as SafeAssistNotification;
            setNotifications((prev) => [notification, ...prev]);

            // Show toast based on severity
            if (notification.severity === "error") {
              toast.error(notification.title, { description: notification.message });
            } else if (notification.severity === "warning") {
              toast.warning(notification.title, { description: notification.message });
            } else {
              toast.info(notification.title, { description: notification.message });
            }
          },
        )
        .subscribe();
      notificationChannelRef.current = notificationChannel;
    },
    [cleanupSessionChannels],
  );

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("safe_assist_notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data as unknown as SafeAssistNotification[]);
    }
  }, [user]);

  // Mark notification as read
  const markNotificationRead = useCallback(async (notificationId: string) => {
    await supabase
      .from("safe_assist_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId);

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n)),
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanupSessionChannels();
    };
  }, [cleanupSessionChannels]);

  // Fetch notifications on mount
  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

  return {
    session,
    isConnected,
    cursorPosition,
    isLoading,
    notifications,
    userCode,
    agentCode,
    createSession,
    joinSession,
    verifyConnection,
    giveConsent,
    endSession,
    sendCursorPosition,
    markNotificationRead,
  };
}
