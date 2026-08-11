import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthenticatedRole } from "@/lib/auth-bridge";
import type { RoleKey } from "@/lib/roles";
import {
  accessibleRoles, can as canFor, canAccessRole, canViewModule,
  type Capability,
} from "@/lib/permissions";

/** Reads the active role from the existing auth system (null until resolved). */
export function useSessionRole() {
  const [state, setState] = useState<{ role: RoleKey | null; ready: boolean }>({
    role: null,
    ready: false,
  });

  useEffect(() => {
    let alive = true;
    getAuthenticatedRole()
      .then((role) => { if (alive) setState({ role, ready: true }); })
      .catch(() => { if (alive) setState({ role: null, ready: true }); });
    return () => { alive = false; };
  }, []);

  return state;
}

/**
 * Permission gate for a dashboard view. `viewRole` is the role whose dashboard
 * is being rendered; capabilities are always evaluated against it.
 */
export function usePermissions(viewRole: RoleKey) {
  const { role: sessionRole, ready } = useSessionRole();

  const can = useCallback((cap: Capability) => canFor(viewRole, cap), [viewRole]);
  const canOpen = useCallback((key: string | null) => canViewModule(viewRole, key), [viewRole]);
  const roles = useMemo(() => accessibleRoles(sessionRole), [sessionRole]);
  const allowedHere = !ready || canAccessRole(sessionRole, viewRole);

  return { sessionRole, ready, allowedHere, can, canOpen, accessibleRoles: roles };
}
