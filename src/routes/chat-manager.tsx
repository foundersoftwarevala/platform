import { createFileRoute } from "@tanstack/react-router";

import { ChatManagerWorkspace } from "@/components/chat-manager/ChatManagerWorkspace";

export const Route = createFileRoute("/chat-manager")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat Manager · Software Vala Connect Hub" },
      {
        name: "description",
        content:
          "Central control panel for the Software Vala chat ecosystem: live conversations, human handoff queue, AI governance, role access and audit trail.",
      },
      { property: "og:title", content: "Chat Manager · Software Vala Connect Hub" },
      {
        property: "og:description",
        content:
          "Manage live conversations, escalations, AI governance and chat permissions from one console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatManagerWorkspace,
  errorComponent: ({ error }) => (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold">Chat Manager unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="grid min-h-[60vh] place-items-center">
      <p className="text-sm text-muted-foreground">Section not found.</p>
    </main>
  ),
});
