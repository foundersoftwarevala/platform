import { createFileRoute } from "@tanstack/react-router";
import { ResearchModule } from "@/components/rd-module/ResearchModule";
import "@/styles/rd-module.css";

export const Route = createFileRoute("/rd-manager")({
  head: () => ({ links: [{ rel: "icon", href: "/rd-module/favicon.png", type: "image/png" }] }),
  component: ResearchModule,
});
