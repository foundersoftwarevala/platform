import { currentUser, rest as serviceRest } from "@/lib/affiliate/core";

import { COCKPIT_ROLES } from "./cockpit";

/**
 * Who may use the Control Panel's own endpoints: a signed-in person holding one
 * of the roles the Control Panel page admits. Roles are read from `user_roles`
 * with the service key, after the person's token has been checked with the
 * auth service.
 */
export type ControlPanelCaller = { id: string; email: string };

export async function controlPanelCaller(
  request: Request,
): Promise<{ ok: true; caller: ControlPanelCaller } | { ok: false; response: Response }> {
  const user = await currentUser(request);
  if (!user) {
    // i18n-ignore: an API error message; this API answers in English.
    return { ok: false, response: Response.json({ error: "Please sign in" }, { status: 401 }) };
  }
  const response = await serviceRest(
    `user_roles?select=role&user_id=eq.${encodeURIComponent(user.id)}`,
  );
  const rows = response.ok ? ((await response.json()) as { role?: string }[]) : [];
  const allowed = rows.some((row) =>
    (COCKPIT_ROLES as readonly string[]).includes(String(row.role ?? "").trim().toLowerCase()),
  );
  if (!allowed) {
    return {
      ok: false,
      response: Response.json(
        // i18n-ignore: an API error message; this API answers in English.
        { error: "The Control Panel is limited to platform operators." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, caller: user };
}
