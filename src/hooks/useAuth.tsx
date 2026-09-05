import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      return;
    }
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    if (error) {
      console.error("Failed to load roles", error.message);
      setRoles([]);
      return;
    }
    setRoles((data ?? []).map((row) => row.role as AppRole));
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
      void loadRoles(nextSession?.user?.id);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
      void loadRoles(data.session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

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
