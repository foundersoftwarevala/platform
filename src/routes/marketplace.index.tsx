import { createFileRoute } from "@tanstack/react-router";
import { pageHead } from "@/lib/seo-head";
import HomeIndex from "@/components/marketplace-home/HomeIndex";

/** /marketplace itself, which is the marketplace home. */
export const Route = createFileRoute("/marketplace/")({
  head: pageHead("Marketplace", "Browse ready-to-deploy software with live demos, full source code and lifetime access."),
  component: HomeIndex,
});
