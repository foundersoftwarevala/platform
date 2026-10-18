import { run } from "./db.server.ts";
import { now, ValaError } from "./util.server.ts";

/**
 * Who may do what in Vala AI.
 *
 * Vala AI has no login of its own: it is operated from the Control Panel, and
 * the caller is whoever the Control Panel session says they are (resolved in
 * `platform-auth.server.ts`). Their platform roles map onto three Vala AI
 * roles, and every API call checks that role on the server.
 *
 *   owner    — boss_owner, boss, founder, super_admin: approves requirements,
 *              change requests, rollbacks and releases; changes settings.
 *   operator — admin, developer: creates projects, requirement drafts, tasks;
 *              requests rollbacks and releases; chats with the agent.
 *   viewer   — the platform's other staff roles: read only.
 */

export type Role = "owner" | "operator" | "viewer";
export type Operator = { id: string; email: string; name: string; role: Role };

const OWNER_ROLES = new Set(["boss_owner", "boss", "founder", "super_admin"]);
const OPERATOR_ROLES = new Set(["admin", "developer"]);
const VIEWER_ROLES = new Set(["employee", "sales", "support", "finance", "sales_support_manager"]);
const RANK: Record<Role, number> = { viewer: 0, operator: 1, owner: 2 };

export function roleFromPlatform(platformRoles: string[]): Role | null {
  if (platformRoles.some((r) => OWNER_ROLES.has(r))) return "owner";
  if (platformRoles.some((r) => OPERATOR_ROLES.has(r))) return "operator";
  if (platformRoles.some((r) => VIEWER_ROLES.has(r))) return "viewer";
  return null;
}

/** Remembers who acted, so history can show an email next to an account id. */
export function recordPerson(op: Operator) {
  run(
    "insert into people (id, email, role, last_seen_at) values (?,?,?,?) on conflict(id) do update set email = excluded.email, role = excluded.role, last_seen_at = excluded.last_seen_at",
    op.id,
    op.email,
    op.role,
    now(),
  );
}

export function requireRole(operator: Operator | null, role: Role): Operator {
  if (!operator) throw new ValaError(401, "Sign in to the Control Panel to use Vala AI.");
  if (RANK[operator.role] < RANK[role])
    throw new ValaError(403, `This action needs the Vala AI ${role} role.`);
  return operator;
}
