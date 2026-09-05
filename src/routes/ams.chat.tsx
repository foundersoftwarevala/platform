import { createFileRoute } from "@tanstack/react-router";
import { ChatScreen } from "@/components/ams/chat/ChatScreen";

export const Route = createFileRoute("/ams/chat")({
  head: () => ({
    meta: [
      { title: "Chat — AMS Enterprise Communication" },
      { name: "description", content: "Role-based enterprise messaging with verified Software Vala IDs, module scope, and context rails." },
      { property: "og:title", content: "Chat — AMS Enterprise Communication" },
      { property: "og:description", content: "Role-scoped enterprise chat with identity verification and module context." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <div className="p-4 lg:p-6">
      <ChatScreen />
    </div>
  ),
});
