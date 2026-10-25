import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "boss_owner"
  | "super_admin"
  | "admin"
  | "sales_support_manager"
  | "franchise"
  | "sales"
  | "support"
  | "client"
  | "customer";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  roles: AppRole[];
  userRole: AppRole | null;
  isBossOwner: boolean;
  isManager: boolean;
  hasRole: (role: AppRole) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const ROLE_PRIORITY: AppRole[] = [
  "boss_owner",
  "super_admin",
  "admin",
  "sales_support_manager",
  "franchise",
  "sales",
  "support",
  "client",
  "customer",
];

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const roleLoadSequence = useRef(0);

  const loadRoles = async (userId: string | undefined) => {
    const requestSequence = ++roleLoadSequence.current;
    if (!userId) {
      setRoles([]);
      return;
    }
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) {
      console.error("Failed to load roles", error.message);
      if (requestSequence === roleLoadSequence.current) setRoles([]);
      return;
    }
    if (requestSequence === roleLoadSequence.current) {
      setRoles((data ?? []).map((row) => row.role as AppRole));
    }
  };

  useEffect(() => {
    let receivedAuthEvent = false;
    let currentUserId: string | null = null;

    const updateSession = (nextSession: Session | null, forceClear = false) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (forceClear || currentUserId !== nextUserId) {
        queryClient.clear();
        currentUserId = nextUserId;
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
      void loadRoles(nextUserId ?? undefined);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      receivedAuthEvent = true;
      updateSession(nextSession, event === "SIGNED_OUT");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!receivedAuthEvent) updateSession(data.session);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const userRole = ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
    return {
      user,
      session,
      isLoading,
      roles,
      userRole,
      isBossOwner: roles.includes("super_admin"),
      isManager: roles.includes("super_admin") || roles.includes("sales_support_manager"),
      hasRole: (role: AppRole) => roles.includes(role),
      signOut: async () => {
        await supabase.auth.signOut();
      },
      refreshRoles: async () => loadRoles(user?.id),
    };
  }, [user, session, isLoading, roles]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
