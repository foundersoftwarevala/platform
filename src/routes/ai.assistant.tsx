import { createFileRoute } from "@tanstack/react-router";
import { absoluteUrl } from "@/lib/seo/site-url";
import { SalesAssistant } from "@/components/marketplace-tools/ProductTools";
import { getStorefrontChrome } from "@/lib/storefront/chrome.functions";
import "@/styles/marketplace-home.css";

/**
 * The sales assistant answers from the live catalogue and the published FAQ.
 * There is no language model configured for the storefront, so it never
 * invents an answer — it either cites real content or hands over to support.
 */
function AssistantPage() {
  const { faqs: publishedFaqs } = Route.useLoaderData();
  const faqs = publishedFaqs.map(({ question, answer }) => ({ question, answer }));
  return <SalesAssistant faqs={faqs} />;
}

export const Route = createFileRoute("/ai/assistant")({
  loader: () => getStorefrontChrome(),
  head: () => ({
    links: [{ rel: "canonical", href: absoluteUrl("/ai/assistant") }],
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
