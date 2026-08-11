import { ROLES, ROLE_ORDER, isRoleKey, type RoleKey } from "@/lib/roles";

/**
 * ───────────────────────────────────────────────────────────────────────────
 * ROLE-BASED PERMISSIONS (single source of truth)
 * ───────────────────────────────────────────────────────────────────────────
 * Every route guard, page action and button reads its capability from here.
 * Module visibility is derived from the role config in `roles.ts`, so a role
 * can never open a module that is not part of its own navigation.
 */

export type Capability =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "export"
  | "import"
  | "approve"
  | "reset_data"
  | "switch_role";

const BASE: Capability[] = ["view", "export"];

const CAPABILITIES: Record<RoleKey, Capability[]> = {
  admin: [
    "view", "create", "update", "delete", "export", "import",
    "approve", "reset_data", "switch_role",
  ],
  "dev-manager": ["view", "create", "update", "delete", "export", "import", "approve", "reset_data"],
  "promise-tracker": ["view", "create", "update", "delete", "export", "approve"],
  franchise: ["view", "create", "update", "delete", "export", "import", "approve"],
  vendor: ["view", "create", "update", "delete", "export", "import"],
  reseller: ["view", "create", "update", "delete", "export", "import"],
  author: ["view", "create", "update", "delete", "export", "import"],
  seo: ["view", "create", "update", "delete", "export"],
  developer: ["view", "create", "update", "export"],
  affiliate: [...BASE, "create"],
  influencer: [...BASE, "create"],
};

/** Extra virtual surfaces a role may open beyond its module list. */
const EXTRA_SURFACES: Record<RoleKey, string[]> = {
  reseller: ["ai-chat", "pricing", "center:*"],
  admin: ["ai-chat", "pricing", "center:*"],
  author: ["ai-chat"],
  vendor: ["ai-chat"],
  affiliate: ["ai-chat"],
  influencer: ["ai-chat"],
  franchise: ["ai-chat"],
  seo: ["ai-chat"],
  developer: ["ai-chat"],
  "dev-manager": ["ai-chat"],
  "promise-tracker": ["ai-chat"],
};

export function can(role: RoleKey | null | undefined, cap: Capability): boolean {
  if (!role || !isRoleKey(role)) return false;
  return CAPABILITIES[role].includes(cap);
}

/** Can this role open the given module / surface key? */
export function canViewModule(role: RoleKey | null | undefined, key: string | null): boolean {
  if (!role || !isRoleKey(role)) return false;
  if (!key) return true; // dashboard home
  const extras = EXTRA_SURFACES[role] ?? [];
  if (extras.includes(key)) return true;
  if (key.startsWith("center:") && extras.includes("center:*")) return true;
  return ROLES[role].modules.some((m) => m.key === key);
}

/** Roles the signed-in user is allowed to open. Admin sees all. */
export function accessibleRoles(sessionRole: RoleKey | null): RoleKey[] {
  if (!sessionRole) return [...ROLE_ORDER]; // auth bridge not wired → preview mode
  if (can(sessionRole, "switch_role")) return [...ROLE_ORDER];
  return [sessionRole];
}

export function canAccessRole(sessionRole: RoleKey | null, target: RoleKey): boolean {
  return accessibleRoles(sessionRole).includes(target);
}
