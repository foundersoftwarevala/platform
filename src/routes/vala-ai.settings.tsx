import { createFileRoute } from "@tanstack/react-router";
import { SettingsPanel } from "@/components/vala-ai/panels/SettingsPanel";

export const Route = createFileRoute("/vala-ai/settings")({
  component: SettingsPanel,
});
