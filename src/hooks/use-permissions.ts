import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthenticatedRoles } from "@/lib/auth-bridge";
import type { RoleKey } from "@/lib/roles";
import {
  accessibleRoles, can as canFor, canAccessRole, canViewModule,
  type Capability,
} from "@/lib/permissions";

/** Reads the active role from the existing auth system (null until resolved). */
export function useSessionRole() {
  const [state, setState] = useState<{ role: RoleKey | null; roles: RoleKey[]; ready: boolean }>({
    role: null,
    roles: [],
    ready: false,
  });

  useEffect(() => {
    let alive = true;
    getAuthenticatedRoles()
      .then((roles) => {
        if (!alive) return;
        const preferred = window.localStorage.getItem("sv_active_role");
        const role = isRoleKey(preferred) && roles.includes(preferred) ? preferred : roles[0] ?? null;
        setState({ role, roles, ready: true });
      })
      .catch(() => { if (alive) setState({ role: null, roles: [], ready: true }); });
    return () => { alive = false; };
  }, []);

  return state;
}

/**
 * Permission gate for a dashboard view. `viewRole` is the role whose dashboard
 * is being rendered; capabilities are always evaluated against it.
 */
export function usePermissions(viewRole: RoleKey) {
  const { role: sessionRole, roles: sessionRoles, ready } = useSessionRole();

  const can = useCallback((cap: Capability) => canFor(viewRole, cap), [viewRole]);
  const canOpen = useCallback((key: string | null) => canViewModule(viewRole, key), [viewRole]);
  const roles = useMemo(() => accessibleRoles(sessionRole, sessionRoles), [sessionRole, sessionRoles]);
  const allowedHere = !ready || canAccessRole(sessionRole, viewRole, sessionRoles);

  return { sessionRole, ready, allowedHere, can, canOpen, accessibleRoles: roles };
}
