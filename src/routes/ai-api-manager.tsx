import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ai-api-manager")({
  beforeLoad: () => {
    throw redirect({ to: "/manager/$section", params: { section: "ai-api" } });
  },
  component: () => null,
});
