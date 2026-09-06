import { useEffect } from "react";

import { supabase } from "./client";

/**
 * Give the realtime socket the signed-in user's token.
 *
 * Every realtime subscription in this project was silently dead. The socket
 * connects with the publishable key, and for a table protected by row-level
 * security that key authorises nothing — Supabase Realtime evaluates the
 * subscriber's own JWT before it will send a postgres_changes payload. Without
 * `setAuth`, the channel subscribes, reports itself SUBSCRIBED, and then never
 * receives a single row change.
 *
 * That affected everything, not just one module: the Task Manager buzzer never
 * reached a second person's screen, the Developer Manager never refreshed when
 * a task moved, and AMS chat delivered nothing live. All of it looked like it
 * worked, because a channel that receives nothing looks exactly like a channel
 * with nothing to receive.
 *
 * This sets the token once on mount and again whenever the session changes, so
 * a sign-in, a sign-out and a token refresh all leave the socket in the right
 * state. It is mounted in the root route, so every page gets it.
 */
export function useRealtimeAuth(): void {
  useEffect(() => {
    let cancelled = false;

    const apply = (token: string | null) => {
      if (cancelled) return;
      try {
        // Passing null drops back to the anon key, which is correct after a
        // sign-out: the socket should stop seeing protected rows immediately.
        supabase.realtime.setAuth(token);
      } catch (error) {
        console.error("[realtime] could not set the socket token", error);
      }
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session?.access_token ?? null))
      .catch(() => apply(null));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session?.access_token ?? null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);
}
