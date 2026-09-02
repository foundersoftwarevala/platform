import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "@/components/chat/user/ChatWorkspace";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/chat")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Connect Chat · Software Vala Enterprise Workspace" },
      {
        name: "description",
        content:
          "Real-time enterprise chat with immutable history, attachments, mentions, receipts, presence, AI assistance and human handoff.",
      },
      { property: "og:title", content: "Connect Chat · Software Vala Enterprise Workspace" },
      {
        property: "og:description",
        content:
          "Real-time enterprise messaging with AI replies, human handoff, attachments, mentions and read receipts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatRoute,
  errorComponent: ({ error }) => (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold">Chat unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="grid min-h-[60vh] place-items-center">
      <p className="text-sm text-muted-foreground">Conversation not found.</p>
    </main>
  ),
});

function ChatRoute() {
  return (
    <>
      <ChatWorkspace />
      <Toaster />
    </>
  );
}
