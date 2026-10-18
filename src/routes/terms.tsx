import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /terms is the address people type and the address other sites link to.
 * The policy itself lives at its canonical /legal/<slug> URL, edited in the
 * Legal Manager, so this is a permanent redirect rather than a second copy of
 * the page - one policy, one URL, no wording that can drift apart.
 */
export const Route = createFileRoute("/terms")({
  beforeLoad: () => {
    throw redirect({ to: "/legal/$slug", params: { slug: "terms-of-service" } });
  },
});
