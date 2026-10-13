import { createFileRoute } from "@tanstack/react-router";
import { Flow } from "../components/vala-ai/screens/Flow";

export const Route = createFileRoute("/vala-ai/flow")({
  component: Flow,
});
