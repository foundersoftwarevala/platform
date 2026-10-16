import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { subscribeNotificationStream } from "@/lib/realtime/notification-stream";

export function useApplicationUpdates() {
  const cache = useQueryClient();
  useEffect(
    () =>
      subscribeNotificationStream((event) => {
        if (
          event.type === "open" ||
          (event.type === "notification" && event.event?.startsWith("application."))
        ) {
          for (const queryKey of [
            ["role-applications"],
            ["role-application"],
            ["application-counts"],
            ["control-panel", "cockpit"],
          ])
            void cache.invalidateQueries({ queryKey });
        }
      }),
    [cache],
  );
}
