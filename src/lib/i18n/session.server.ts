import { createHash, randomBytes } from "node:crypto";

import { db } from "./database.server";
import type { Caller } from "./service.server";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** The token is opaque, revocable, and stored only as a hash in canonical PostgreSQL. */
export async function sessionCaller(token: string): Promise<Caller | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const sql = await db();
  const rows = await sql<{ user_id: string; operator: boolean }[]>`
    select * from public.i18n_native_session_caller(${digest(token)})
  `;
  const row = rows[0];
  return row
    ? {
        userId: row.user_id,
        subject: `user:${row.user_id}`,
        tier: row.operator ? "operator" : "user",
      }
    : null;
}

export async function createLanguageSession(
  email: string,
  password: string,
): Promise<string | null> {
  const sql = await db();
  const token = randomBytes(32).toString("hex");
  const rows = await sql<{ id: string }[]>`
    select public.i18n_native_create_session(${email}, ${password}, ${digest(token)}) as id
  `;
  if (!rows[0]?.id) return null;
  return token;
}

export async function revokeLanguageSession(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return;
  const sql = await db();
  await sql`select public.i18n_native_revoke_session(${digest(token)})`;
}
