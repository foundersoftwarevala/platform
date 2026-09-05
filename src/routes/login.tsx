import { createFileRoute } from "@tanstack/react-router";
import { CanonicalLogin } from "@/components/auth/CanonicalLogin";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Software Vala — Nexus OS Login" }] }),
  component: () => <CanonicalLogin />,
});