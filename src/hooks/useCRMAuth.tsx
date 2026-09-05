import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * The Sales CRM screens originally shipped with their own auth context.
 * Software Vala has a single session, so this simply projects the app session
 * into the shape those screens expect. No separate CRM login exists.
 */
export const CRMAuthProvider = ({ children }: { children: ReactNode }) => <>{children}</>;

export const useCRMAuth = () => {
  const { user, session, isLoading, signOut } = useAuth();
  return { user, session, isLoading, signOut };
};
