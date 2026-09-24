/** The marketplace storefront (src/components/marketplace-home). English only. */
export const MARKETPLACE_MESSAGES = {
  "marketplace.search.searching": "Searching the marketplace…",
  "marketplace.search.results": ["Results for “{query}”", "heading above the search results"],
  "marketplace.search.none":
    "No product matches “{query}”. Try another word, or browse the categories.",
  "marketplace.search.failed": "Search is unavailable right now.",
  "marketplace.search.retry": ["Try again", "button that repeats a failed search"],

  // The card slot page: one category in one country, at its own permanent URL.
  // The card's own words stay the same whichever product is in it, so they are
  // keyed here rather than written into the page.
  "marketplace.slot.not_found": [
    "There is no card at that address.",
    "shown when the category and country in the URL are not a card",
  ],
  "marketplace.slot.back": ["Back to the marketplace", "link out of a card page"],
  "marketplace.slot.breadcrumb": ["Breadcrumb", "label of the trail of links above the heading"],
  "marketplace.slot.marketplace": ["Marketplace", "first step of the breadcrumb"],
  "marketplace.slot.card_position": [
    "Card {position} of {total}",
    "where this country sits in the row of country cards",
  ],
  "marketplace.slot.features_heading": [
    "Features and Modules",
    "heading above the product currently in the card",
  ],
  "marketplace.slot.deployment": ["Deployment", "how a product is hosted: cloud, on premise"],
  "marketplace.slot.licence": ["Licence", "the licence a product is sold under"],
  "marketplace.slot.type": ["Type", "the sub-category a product belongs to"],
  "marketplace.slot.live_demo": ["Live demo", "whether a working demo can be opened"],
  "marketplace.slot.demo_available": ["Available", "a live demo exists for this product"],
  "marketplace.slot.demo_on_request": ["On request", "no live demo is recorded for this product"],
  "marketplace.slot.technology_listed": [
    "Technology: {stack}.",
    "the stack an author recorded for this product",
  ],
  "marketplace.slot.technology_unknown":
    "Technology is product-dependent and must be verified from the actual implementation.",
  "marketplace.slot.open_product": ["Open {product}", "button leading to the product's own page"],
  "marketplace.slot.vacant_title": [
    "This card is open",
    "heading shown when no product occupies the card",
  ],
  "marketplace.slot.vacant_body":
    "No {category} product is published for {country} yet. The card keeps its place in the row, and the next product accepted for this category and country takes it.",
  "marketplace.slot.see_all_category": [
    "See every {category} product",
    "link to the category from an empty card",
  ],
  "marketplace.slot.other_countries": [
    "{category} in other countries",
    "heading above the same card in every other country",
  ],
  "marketplace.slot.countries_filled":
    "The same card exists in {total} countries, {filled} of them filled.",
  "marketplace.slot.other_software": [
    "Other software for {country}",
    "heading above every other category in this country",
  ],
  "marketplace.slot.everything_for": [
    "Everything the catalogue holds for {country}",
    "link to the country page",
  ],
  "marketplace.slot.faq_heading": ["Frequently Asked Questions", "heading above the questions"],
} as const;
