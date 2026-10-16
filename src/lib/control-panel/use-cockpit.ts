import { useQuery } from "@tanstack/react-query";

import { authHeaders } from "@/lib/auth/operator-fetch";

import type { CockpitFigures } from "./cockpit";
import { useApplicationUpdates } from "@/lib/applications/use-application-updates";

/** Shared figures, invalidated by application events with a 15-second polling fallback. */
export function useCockpitFigures() {
  useApplicationUpdates();
  return useQuery({
    queryKey: ["control-panel", "cockpit"],
    queryFn: async (): Promise<CockpitFigures> => {
      const response = await fetch("/api/control-panel/cockpit", { headers: await authHeaders() });
      const body = (await response.json().catch(() => ({}))) as CockpitFigures & { error?: string };
      if (!response.ok)
        throw new Error(body.error ?? `The cockpit figures could not be read (${response.status})`);
      return body;
    },
    refetchInterval: 15_000,
  });
}
