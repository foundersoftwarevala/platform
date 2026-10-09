import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { Chat } from "@/components/vala-ai/screens/Chat";

export const Route = createFileRoute("/vala-ai/chat")({
  head: pageHead("AI Task Chat · Vala AI", "Talk to the local model about a project."),
  component: Chat,
});
