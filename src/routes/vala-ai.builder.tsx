import { createFileRoute } from "@tanstack/react-router";
import { Builder } from "../components/vala-ai/screens/Builder";

export const Route = createFileRoute("/vala-ai/builder")({
  component: Builder,
});
