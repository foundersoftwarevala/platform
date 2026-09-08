import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { SettingsPanel } from "@/components/vala-ai/panels/SettingsPanel";

export const Route = createFileRoute("/vala-ai/settings")({
  head: pageHead("Settings · Vala AI", "Configuration for the AI workspace."),
  component: SettingsPanel,
});
