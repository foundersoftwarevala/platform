import { getRequestHeader } from "@tanstack/react-start/server";
import { requireJson, requireJsonObject, type Json } from "@/lib/json";

type CallerOptions = { allowAnonymous?: boolean };

export async function createUserClient(options: CallerOptions = {}) {
  const header = getRequestHeader("authorization") ?? getRequestHeader("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token && !options.allowAnonymous) throw new Error("Unauthorized: sign in required");

  const { createClient } = await import("@supabase/supabase-js");
  const base = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  return createClient(base, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  });
}

export async function callAsUser<T extends Json>(
  fn: string,
  args: Record<string, unknown>,
  options: CallerOptions = {},
): Promise<T> {
  const client = await createUserClient(options);
  const payload = requireJsonObject(args, `RPC ${fn} arguments`);
  const { data, error } = await client.rpc(fn, payload);
  if (error) throw new Error(error.message);
  // RPC-specific shapes stay at the call sites; enforce their shared wire contract here.
  return requireJson(data, `RPC ${fn} response`) as T;
}
