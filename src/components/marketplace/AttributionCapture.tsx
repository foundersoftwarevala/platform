import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

import { captureFirstTouch } from "@/lib/marketplace/attribution";

/**
 * Remembers where a visit began, so a lead can say which page earned it.
 *
 * The information is in the address bar and the referrer of the *first* page
 * of a visit and nowhere else, and by the time somebody reaches a demo form
 * several pages later it has been replaced by an internal hop. So it is read
 * on arrival and kept for the tab.
 *
 * Mounted beside ReferralCapture at the root, which is the one place that runs
 * on every page. It renders nothing, reads only what the browser already hands
 * every page, and writes only to sessionStorage - nothing is sent anywhere
 * until the visitor chooses to become a lead.
 */
export function AttributionCapture() {
  const href = useRouterState({ select: (s) => s.location.href });

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Safe on every page: after the first call that saw something worth
    // keeping, this does nothing. First touch wins, because the page that
    // earned the visit is the one search ranked, not the last one read.
    captureFirstTouch();
  }, [href]);

  return null;
}

export default AttributionCapture;
