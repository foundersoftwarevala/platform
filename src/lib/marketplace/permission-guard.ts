/**
 * The Marketplace permission guard.
 *
 * Section 2 asks this to support "the existing role hierarchy" and names
 * OWNER, ADMIN, MANAGER, AUDITOR, VIEWER. Those are not the roles this
 * platform has. user_roles holds admin, boss, developer, customer, sales,
 * reseller, franchise, author, vendor, affiliate, influencer, seo, marketing,
 * finance, employee and support, and public.mm_is_operator() already decides
 * who may operate the Marketplace Manager at all. Inventing a second, parallel
 * role model beside that one is exactly the duplication Parts 1 to 3 were
 * careful to avoid, so this maps the real roles instead and stays extensible,
 * which is what section 2's second sentence actually asks for.
 *
 * The matrix lives in system_settings under one key, the same way the Action
 * Layer registry and the colour palette do. marketplace_permissions does not
 * exist and this project has no path to run DDL.
 *
 * Section 11 is the important distinction and it is honoured throughout:
 * HIDDEN when the role has no business knowing the action exists, DISABLED
 * with a reason when it may act but this record's state says no.
 */

export type Permission =
  | "marketplace.view" | "marketplace.create" | "marketplace.edit" | "marketplace.delete"
  | "marketplace.approve" | "marketplace.reject"
  | "marketplace.publish" | "marketplace.unpublish"
  | "marketplace.archive" | "marketplace.restore" | "marketplace.duplicate"
  | "marketplace.import" | "marketplace.export"
  | "marketplace.pricing" | "marketplace.category" | "marketplace.license"
  | "marketplace.feature" | "marketplace.pin"
  | "marketplace.actions.configure" | "marketplace.colors.configure"
  | "marketplace.permissions.configure"
  | "marketplace.audit.view" | "marketplace.audit.export"
  | "marketplace.settings.view" | "marketplace.settings.manage";

export const ALL_PERMISSIONS: Permission[] = [
  "marketplace.view", "marketplace.create", "marketplace.edit", "marketplace.delete",
  "marketplace.approve", "marketplace.reject",
  "marketplace.publish", "marketplace.unpublish",
  "marketplace.archive", "marketplace.restore", "marketplace.duplicate",
  "marketplace.import", "marketplace.export",
  "marketplace.pricing", "marketplace.category", "marketplace.license",
  "marketplace.feature", "marketplace.pin",
  "marketplace.actions.configure", "marketplace.colors.configure",
  "marketplace.permissions.configure",
  "marketplace.audit.view", "marketplace.audit.export",
  "marketplace.settings.view", "marketplace.settings.manage",
];

/**
 * What each real role may do.
 *
 * boss and boss_owner are the owner tier; admin, super_admin, founder and
 * owner are the administrative tier; marketing and seo are the two roles
 * mm_is_operator() admits beyond the operators, and they get operational
 * permissions without configuration or deletion. Everything else has no
 * Marketplace Manager permission at all, which is what the route gate already
 * enforces - this simply agrees with it rather than contradicting it.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  boss: ALL_PERMISSIONS,
  boss_owner: ALL_PERMISSIONS,

  admin: ALL_PERMISSIONS.filter((p) => p !== "marketplace.permissions.configure"),
  super_admin: ALL_PERMISSIONS.filter((p) => p !== "marketplace.permissions.configure"),
  founder: ALL_PERMISSIONS.filter((p) => p !== "marketplace.permissions.configure"),
  owner: ALL_PERMISSIONS.filter((p) => p !== "marketplace.permissions.configure"),

  // Operational, not configurational. No delete, no permission or colour
  // configuration - section 5.
  marketing: [
    "marketplace.view", "marketplace.create", "marketplace.edit",
    "marketplace.approve", "marketplace.reject",
    "marketplace.publish", "marketplace.unpublish",
    "marketplace.archive", "marketplace.restore", "marketplace.duplicate",
    "marketplace.export", "marketplace.category",
    "marketplace.feature", "marketplace.pin",
    "marketplace.audit.view", "marketplace.settings.view",
  ],
  seo: [
    "marketplace.view", "marketplace.edit",
    "marketplace.publish", "marketplace.unpublish",
    "marketplace.export", "marketplace.category",
    "marketplace.audit.view", "marketplace.settings.view",
  ],
};

export const PERMISSION_KEY = "marketplace_role_permissions";

/** Which permission each action needs. One place, so nothing drifts. */
export const ACTION_PERMISSION: Record<string, Permission> = {
  view: "marketplace.view",
  preview: "marketplace.view",
  live_demo: "marketplace.view",
  audit: "marketplace.audit.view",
  edit: "marketplace.edit",
  create: "marketplace.create",
  duplicate: "marketplace.duplicate",
  publish: "marketplace.publish",
  unpublish: "marketplace.unpublish",
  archive: "marketplace.archive",
  restore: "marketplace.restore",
  delete: "marketplace.delete",
  approve: "marketplace.approve",
  reject: "marketplace.reject",
  export: "marketplace.export",
  import: "marketplace.import",
  pricing: "marketplace.pricing",
  category: "marketplace.category",
  license: "marketplace.license",
  feature: "marketplace.feature",
  pin: "marketplace.pin",
  configure_actions: "marketplace.actions.configure",
  configure_colors: "marketplace.colors.configure",
  configure_permissions: "marketplace.permissions.configure",
};

/** Actions nobody but the owner tier may take, whatever the matrix says. */
export const OWNER_ONLY: Permission[] = ["marketplace.permissions.configure"];

export type Decision = {
  /** False means the role has no business knowing this exists - section 11. */
  visible: boolean;
  /** True means it may run now. */
  enabled: boolean;
  /** Why not, when it cannot. Null when it can. */
  reason: string | null;
  requiresConfirmation: boolean;
  requiresOverride: boolean;
};

/**
 * The one decision function.
 *
 * `roles` are the caller's actual roles, read from user_roles on the server.
 * `stateReason` is whatever the record's own state says, so a role that may
 * publish still sees Publish disabled on an unapproved record with that
 * reason, rather than the action vanishing.
 */
export function resolveAction(input: {
  roles: string[];
  action: string;
  permissions?: Record<string, Permission[]>;
  stateReason?: string | null;
  confirmationRequired?: boolean;
}): Decision {
  const matrix = input.permissions ?? ROLE_PERMISSIONS;
  const needed = ACTION_PERMISSION[input.action];

  if (!needed) {
    return {
      visible: false, enabled: false,
      reason: `Unknown action "${input.action}".`,
      requiresConfirmation: false, requiresOverride: false,
    };
  }

  const granted = new Set<Permission>();
  for (const role of input.roles) {
    for (const p of matrix[role] ?? []) granted.add(p);
  }

  if (!granted.has(needed)) {
    // Hidden, not disabled: no permission means no business knowing.
    return {
      visible: false, enabled: false,
      reason: `Permission ${needed} is required.`,
      requiresConfirmation: false,
      requiresOverride: OWNER_ONLY.includes(needed),
    };
  }

  if (input.stateReason) {
    // Permitted, but this record says no. Shown, disabled, and the reason
    // given - section 11's second case.
    return {
      visible: true, enabled: false, reason: input.stateReason,
      requiresConfirmation: Boolean(input.confirmationRequired),
      requiresOverride: false,
    };
  }

  return {
    visible: true, enabled: true, reason: null,
    requiresConfirmation: Boolean(input.confirmationRequired),
    requiresOverride: false,
  };
}
