import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /ams opens the Command Center.
 *
 * In the reference application the AMS module is the whole app, so its Command
 * Center sits at "/". Here the module is mounted at /ams and that screen lives
 * at /ams/overview, so this sends the bare /ams address there rather than
 * duplicating the same screen at two paths.
 */
export const Route = createFileRoute("/ams/")({
  beforeLoad: () => {
    throw redirect({ to: "/ams/overview" });
  },
});
