import { createFileRoute } from "@tanstack/react-router";

import { RequireRole } from "@/components/auth/RequireRole";
import ServerManagerDashboard from "@/components/server-manager/ServerManagerDashboard";
import { Toaster } from "@/components/ui/sonner";

/**
 * Server Manager — the infrastructure command centre.
 *
 * The Control Panel has carried a "Server Manager" button for some time, but it
 * pointed at /manager/monitoring, which is the API usage monitor — a different
 * thing entirely, and the closest match that existed when that button was
 * wired. There was no Server Manager module behind it: no server tables, no
 * fleet, no telemetry.
 *
 * The module now mounted here brings the twenty-four screens the Control Panel
 * menu already promised — Dashboard, Live Monitoring, Alerts & Incidents, AI
 * Health, Servers, Registry, Add Server, Server Login, Performance, Resource
 * Usage, Network, Uptime & SLA, Deployments, Backup Manager, Storage,
 * Maintenance, Security & Firewall, Logs, Audit Trail, Reports, Explore Plans,
 * Buy New Server, Billing & Usage and Settings — with its own sidebar, which is
 * exactly the structure that menu describes.
 *
 * It is mounted at /server-manager inside the Control Panel's own routing. It
 * does not touch the marketplace home page, the Control Panel itself, or any
 * other manager, and /manager/monitoring is left working as it was.
 *
 * Access is operator-level, because this manages real infrastructure. The
 * database enforces the same thing independently: every one of the twenty-five
 * server tables has row-level security, a server is visible to its owner and to
 * operators and to nobody else, and the anonymous role is refused outright.
 */
export const Route = createFileRoute("/server-manager")({
  head: () => ({
    meta: [
      { title: "Server Manager — Software Vala Control Panel" },
      {
        name: "description",
        content:
          "Infrastructure command centre: fleet health, live telemetry, alerts and incidents, backups, deployments, security and audit across connected servers.",
      },
      { property: "og:title", content: "Server Manager — Software Vala" },
      {
        property: "og:description",
        content: "Connect, monitor, protect and maintain your server infrastructure.",
      },
      // An infrastructure console has no business in a search index.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ServerManagerRoute,
  // One screen failing must never take the Control Panel down with it. The
  // module isolates each screen behind its own boundary; this is the outer net.
  errorComponent: ({ error }) => (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <section className="max-w-md space-y-3">
        <h1 className="text-xl font-semibold">Server Manager could not start</h1>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <a
          href="/control-panel"
          className="inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Back to Control Panel
        </a>
      </section>
    </main>
  ),
});

function ServerManagerRoute() {
  return (
    <RequireRole role={["developer"]}>
      <div className="creator-theme min-h-screen">
        <ServerManagerDashboard />
        <Toaster richColors position="bottom-right" />
      </div>
    </RequireRole>
  );
}
