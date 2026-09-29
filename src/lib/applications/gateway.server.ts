/**
 * How the application code reaches the database.
 *
 * Two ways, used deliberately: reads the server makes on staff's behalf go with
 * the service key after staff have been checked, and every submission and
 * every decision goes as the person making it, with their own token, so the
 * database's own rules - who may apply, who may decide, never your own
 * application - apply to them exactly as written.
 */

export { rest as serviceRest } from "@/lib/affiliate/core";

function base(): string {
  return (process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
}

function publishableKey(): string {
  return (process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.SUPABASE_ANON_KEY?.trim()) ?? "";
}

export function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export type RpcOutcome<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

/** A database function called as the signed-in person. */
export async function rpcAs<T = Record<string, unknown>>(
  token: string,
  fn: string,
  args: Record<string, unknown>,
): Promise<RpcOutcome<T>> {
  if (!base()) return { ok: false, status: 503, message: "The application service is not configured." };
  const response = await fetch(`${base()}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: publishableKey(),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await response.text();
  if (!response.ok) {
    // The function's own refusal - already decided, not staff, a missing
    // field - is the answer to show, not a server fault.
    let message = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { message?: string };
      if (parsed.message) message = parsed.message;
    } catch {
      /* the raw text is the message */
    }
    const status = response.status >= 500 ? 400 : response.status === 401 ? 401 : response.status === 403 ? 403 : 400;
    return { ok: false, status, message };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return { ok: true, data: text as unknown as T };
  }
}

/** Whether the caller may review applications - the database's own answer. */
export async function isApplicationStaff(token: string): Promise<boolean> {
  const outcome = await rpcAs<boolean>(token, "application_staff", {});
  return outcome.ok && outcome.data === true;
}
