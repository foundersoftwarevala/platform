import { createFileRoute } from "@tanstack/react-router";
import { CommandCenter } from "@/components/vala-ai/screens/CommandCenter";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/vala-ai/command-center")({
  head: pageHead("Command Center · Vala AI", "Live model, sandbox and execution status."),
  component: CommandCenter,
});
