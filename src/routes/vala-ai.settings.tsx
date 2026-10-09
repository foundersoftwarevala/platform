import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import { SettingsScreen } from "@/components/vala-ai/screens/SettingsScreen";

export const Route = createFileRoute("/vala-ai/settings")({
  head: pageHead("Settings & System · Vala AI", "Limits and measured system status."),
  component: SettingsScreen,
});
