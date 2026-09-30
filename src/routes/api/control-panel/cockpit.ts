import { createFileRoute } from "@tanstack/react-router";

import { rest as serviceRest } from "@/lib/affiliate/core";
import { APPLICATION_KINDS, listApplications } from "@/lib/applications/registry.server";
import { controlPanelCaller } from "@/lib/control-panel/access.server";
import type { CockpitFigures } from "@/lib/control-panel/cockpit";

/**
 * The Control Panel cockpit's figures.
 *
 *   GET /api/control-panel/cockpit
 *
 * The figures are counted by the database's control_panel_cockpit(), which
 * only the service role may call, so this route decides who sees them: the
 * same roles the Control Panel page itself admits. Pending role applications
 * come from the application registry, which owns the rule for what an open
 * application is, rather than being counted a second way here.
 */
export const Route = createFileRoute("/api/control-panel/cockpit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const access = await controlPanelCaller(request);
        if (!access.ok) return access.response;

        const [figures, applications] = await Promise.all([
          serviceRest("rpc/control_panel_cockpit", { method: "POST", body: "{}" }),
          listApplications([...APPLICATION_KINDS], true).then(
            (rows) => rows.length,
            (error: unknown) => {
              console.error("[cockpit] applications unavailable", error);
              return null;
            },
          ),
        ]);
        if (!figures.ok) {
          console.error("[cockpit] figures unavailable", figures.status, await figures.text());
          return Response.json(
            // i18n-ignore: an API error message; this API answers in English.
            { error: "The cockpit figures could not be read." },
            { status: 502 },
          );
        }
        const body = (await figures.json()) as CockpitFigures;
        return Response.json(
          { ...body, role_applications: applications } satisfies CockpitFigures,
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
