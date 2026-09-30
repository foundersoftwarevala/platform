import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { subscribeNotificationStream } from "@/lib/realtime/notification-stream";
import { unlockAudioOnFirstGesture } from "@/lib/ams/ui-sound";
import { useCelebration, type Recognition } from "./Celebration";

/**
 * The one place a recognition reaches the screen.
 *
 *   ledger line (the engine granted something)
 *   -> notification + database announcement
 *   -> live stream -> here: a recognition id
 *   -> claim on the server (ams_recognition_claim)
 *   -> the queue in CelebrationProvider -> animation + one sound
 *
 * Nothing here decides what was earned. The id only says where to look; the
 * claim returns the recognition as the server describes it, and only to the
 * person it belongs to. The claim is also the seen-marker: a line is claimed
 * once, ever, so a refresh, a second tab, a reconnect or the same announcement
 * twice cannot show it again.
 *
 * Claims wait for a visible tab, so a recognition is not spent on a tab
 * nobody is looking at. Anything announced while the stream was down is picked
 * up on reconnect, limited to what was granted since this page opened - old
 * recognition is history, not news.
 */

/** Recognitions granted together arrive within a moment; wait that long. */
const GATHER_MS = 600;
/** Without a live stream, look this often while the tab is visible. */
const POLL_MS = 20_000;

export function RecognitionDetector() {
  const { presentRecognitions } = useCelebration();
  const qc = useQueryClient();
  const pending = useRef(new Set<string>());
  const handled = useRef(new Set<string>());
  const since = useRef(new Date().toISOString());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claiming = useRef(false);
  const signedIn = useRef(false);

  useEffect(() => {
    unlockAudioOnFirstGesture();
    let alive = true;
    let poll: ReturnType<typeof setInterval> | null = null;

    const flush = async () => {
      timer.current = null;
      if (!alive || claiming.current || pending.current.size === 0) return;
      if (document.visibilityState !== "visible") return; // resumed on visibilitychange
      const ids = [...pending.current].slice(0, 50);
      ids.forEach((id) => {
        pending.current.delete(id);
        handled.current.add(id);
      });
      claiming.current = true;
      try {
        const { data, error } = await supabase.rpc("ams_recognition_claim" as never, { p_ledger_ids: ids } as never);
        if (error) throw error;
        const claimed = ((data as { claimed?: Recognition[] } | null)?.claimed ?? []).filter(Boolean);
        if (claimed.length > 0) {
          presentRecognitions(claimed);
          // What the person sees elsewhere follows the recognition.
          void qc.invalidateQueries({ queryKey: ["ams"] });
          void qc.invalidateQueries({ queryKey: ["notification-bell"] });
        }
      } catch {
        // Not claimed, so not lost: the next catch-up finds them again.
        ids.forEach((id) => handled.current.delete(id));
      } finally {
        claiming.current = false;
        if (pending.current.size > 0) schedule();
      }
    };

    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), GATHER_MS);
    };

    const offer = (id: string | null | undefined) => {
      if (!id || handled.current.has(id) || pending.current.has(id)) return;
      pending.current.add(id);
      schedule();
    };

    const catchUp = async () => {
      if (!alive || !signedIn.current) return;
      const { data } = await supabase.rpc("ams_recognition_pending" as never, { p_since: since.current } as never);
      const ids = (data as { pending?: string[] } | null)?.pending ?? [];
      ids.forEach(offer);
    };

    const unsubscribe = subscribeNotificationStream((e) => {
      if (e.type === "open") {
        if (poll) clearInterval(poll);
        poll = null;
        void catchUp();
      } else if (e.type === "unavailable") {
        // No live stream from this server: look periodically instead.
        if (!poll) poll = setInterval(() => {
          if (document.visibilityState === "visible") void catchUp();
        }, POLL_MS);
        void catchUp();
      } else if (e.type === "notification" && e.event?.startsWith("ams.recognition.")) {
        offer(e.ledger_id);
      }
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void catchUp();
      if (pending.current.size > 0) schedule();
    };
    document.addEventListener("visibilitychange", onVisible);

    // Recognition belongs to whoever is signed in now; a new person starts clean.
    const readUser = (id: string | null) => {
      signedIn.current = Boolean(id);
      pending.current.clear();
      handled.current.clear();
      since.current = new Date().toISOString();
    };
    void supabase.auth.getUser().then(({ data }) => {
      if (alive) {
        signedIn.current = Boolean(data.user?.id);
        if (signedIn.current) void catchUp();
      }
    });
    let lastUser: string | null = null;
    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      const id = session?.user?.id ?? null;
      if (id !== lastUser) {
        lastUser = id;
        readUser(id);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
      authSub.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      if (poll) clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [presentRecognitions, qc]);

  return null;
}
