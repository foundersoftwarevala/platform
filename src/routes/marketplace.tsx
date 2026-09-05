import { createFileRoute } from "@tanstack/react-router";
import HomeIndex from "@/components/marketplace-home/HomeIndex";

export const Route = createFileRoute("/marketplace")({
  component: HomeIndex,
});
