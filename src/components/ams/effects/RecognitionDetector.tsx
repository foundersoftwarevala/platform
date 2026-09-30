import { useEffect, useRef } from "react";
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
 *   -> read on the server (ams_recognition_peek), without marking it seen
 *   -> the queue in CelebrationProvider, which claims each presentation as it
 *      begins (ams_recognition_claim) -> animation + one sound
 *
 * Nothing here decides what was earned. The id only says where to look; the
 * server returns the recognition as it describes it, and only to the person it
 * belongs to. The claim is the seen-marker and happens when the recognition is
 * actually shown: a line is claimed once, ever, so a refresh, a second tab, a
 * reconnect or the same announcement twice cannot show it again - and a
 * refresh or a closed tab before it was shown does not lose it.
 *
 * On every (re)connect the page asks for recognition granted in the last day
 * and not yet shown: what arrived while the stream was down, or while no page
 * was open. Recognition from before recognition was presented is history and
 * was marked so.
 */

/** Recognitions granted together arrive within a moment; wait that long. */
const GATHER_MS = 600;
/** Without a live stream, look this often while the tab is visible. */
const POLL_MS = 20_000;
/** How far back an unseen recognition is still news. */
const LOOKBACK_MS = 24 * 60 * 60 * 1000;
const lookback = () => new Date(Date.now() - LOOKBACK_MS).toISOString();

export function RecognitionDetector() {
  const { presentRecognitions } = useCelebration();
  const pending = useRef(new Set<string>());
  const handled = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reading = useRef(false);
  const signedIn = useRef(false);

  useEffect(() => {
    unlockAudioOnFirstGesture();
    let alive = true;
    let poll: ReturnType<typeof setInterval> | null = null;

    const flush = async () => {
      timer.current = null;
      if (!alive || reading.current || pending.current.size === 0) return;
      if (document.visibilityState !== "visible") return; // resumed on visibilitychange
      const ids = [...pending.current].slice(0, 50);
      ids.forEach((id) => {
        pending.current.delete(id);
        handled.current.add(id);
      });
      reading.current = true;
      try {
        const { data, error } = await supabase.rpc("ams_recognition_peek" as never, { p_ledger_ids: ids } as never);
        if (error) throw error;
        const unseen = ((data as { recognitions?: Recognition[] } | null)?.recognitions ?? []).filter(Boolean);
        if (unseen.length > 0) presentRecognitions(unseen);
      } catch {
        // Not read, so not lost: the next catch-up finds them again.
        ids.forEach((id) => handled.current.delete(id));
      } finally {
        reading.current = false;
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
      const { data } = await supabase.rpc("ams_recognition_pending" as never, { p_since: lookback() } as never);
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
  }, [presentRecognitions]);

  return null;
}
