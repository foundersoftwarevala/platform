import { createFileRoute } from "@tanstack/react-router";
import HomeIndex from "@/components/marketplace-home/HomeIndex";

/** /marketplace itself, which is the marketplace home. */
export const Route = createFileRoute("/marketplace/")({
  component: HomeIndex,
});
