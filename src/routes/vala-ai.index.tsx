import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { CommandCenter } from "@/components/vala-ai/screens/CommandCenter";

export const Route = createFileRoute("/vala-ai/")({
  head: pageHead(
    "Command Center · Vala AI",
    "Live state of the Vala AI agent, its local model and every task.",
  ),
  component: CommandCenter,
});
