/** The marketplace storefront (src/components/marketplace-home). English only. */
export const MARKETPLACE_MESSAGES = {
  "marketplace.search.searching": "Searching the marketplace…",
  "marketplace.search.results": ["Results for “{query}”", "heading above the search results"],
  "marketplace.search.none":
    "No product matches “{query}”. Try another word, or browse the categories.",
  "marketplace.search.failed": "Search is unavailable right now.",
  "marketplace.search.retry": ["Try again", "button that repeats a failed search"],

  /* The merchandising badges on a product card. Which of these a card draws is
     decided in Product Card Manager; each one is shown only for a product whose
     record carries the matching flag. */
  "marketplace.card.badge.featured": ["Featured", "badge on a product card"],
  "marketplace.card.badge.new": ["New", "badge on a product card, for a recent release"],
  "marketplace.card.badge.trending": ["Trending", "badge on a product card"],
  "marketplace.card.badge.bestseller": ["Best seller", "badge on a product card"],

  /* The two panels on a product card. A panel is only offered when the product
     has something to put in it. */
  "marketplace.card.tab.features": ["Features", "tab on a product card"],
  "marketplace.card.tab.tech": ["Tech Stack", "tab on a product card, the technologies it is built with"],
} as const;
