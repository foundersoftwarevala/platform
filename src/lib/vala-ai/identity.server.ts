import type { Operator } from "./auth.server.ts";
import { all } from "./db.server.ts";

/**
 * Turns the account ids stored in records into something a person recognises.
 *
 * Owners and operators see the email Vala AI recorded for an account when it
 * last used Vala AI (the people table). Viewers keep seeing the bare id, so the
 * read-only role learns nothing new about colleagues. The agent's own actions
 * read "Vala AI agent (T-…)". An id never seen is shown as it is.
 */
export type Labeler = (id: string | null | undefined) => string | null;

export function labelerFor(caller: Operator | null): Labeler {
  const showEmail = caller?.role === "owner" || caller?.role === "operator";
  const emails = new Map<string, string>(
    showEmail
      ? all<{ id: string; email: string }>("select id, email from people").map((p) => [
          p.id,
          p.email,
        ])
      : [],
  );
  return (id) => {
    if (!id) return null;
    const agent = /^agent:(T-[A-Z0-9]+)$/.exec(id);
    if (agent) return `Vala AI agent (${agent[1]})`;
    return emails.get(id) || id;
  };
}

/** Adds `<field>_label` next to each named id field. */
export function withLabels<T extends object>(
  rows: T[],
  fields: (keyof T & string)[],
  label: Labeler,
): (T & Record<string, string | null>)[] {
  return rows.map((row) => {
    const extra: Record<string, string | null> = {};
    for (const f of fields) extra[`${f}_label`] = label(row[f] as unknown as string | null);
    return { ...row, ...extra };
  });
}
