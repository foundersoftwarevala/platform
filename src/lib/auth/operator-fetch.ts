import { supabase } from "@/integrations/supabase/client";

/**
 * The signed-in operator's bearer token, for calls made with plain `fetch`.
 *
 * The middleware that attaches a Supabase token attaches it only to
 * server-function RPCs. The manager panels call their endpoints as ordinary
 * fetches, so they sent no token at all: the guard saw no signed-in user and
 * refused every read and every save. The panels looked live and controlled
 * nothing.
 *
 * The session is read at call time rather than captured once, so a token that
 * has since been refreshed is the one that gets sent. If there is no session
 * the call goes out unauthenticated and the endpoint refuses it, which is the
 * correct outcome - this never invents access.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
