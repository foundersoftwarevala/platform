import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { SalesAssistant } from "@/components/marketplace-tools/ProductTools";
import { listPublishedFaqs } from "@/lib/site-content/faq";
import "@/styles/marketplace-home.css";

/**
 * The sales assistant answers from the live catalogue and the published FAQ.
 * There is no language model configured for the storefront, so it never
 * invents an answer — it either cites real content or hands over to support.
 */
function AssistantPage() {
  const faqs = useMemo(
    () => listPublishedFaqs().map((f) => ({ question: f.question, answer: f.answer })),
    [],
  );
  return <SalesAssistant faqs={faqs} />;
}

export const Route = createFileRoute("/ai/assistant")({
  head: () => ({
    meta: [
      { title: "Sales Assistant | Software Vala" },
      {
        name: "description",
        content:
          "Ask about any Software Vala product, price, demo or licence and get an answer from the live catalogue.",
      },
      { property: "og:title", content: "Sales Assistant | Software Vala" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AssistantPage,
});
