import { createFileRoute, redirect } from "@tanstack/react-router";

/** The retired marketplace home must always resolve to the canonical home. */
export const Route = createFileRoute("/marketplace/")({
  beforeLoad: () => {
    throw redirect({ to: "/", statusCode: 301 });
  },
});
