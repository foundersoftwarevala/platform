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
  "marketplace.footer.no_advance_payment": [
    "No advance payment — you see the demo first.",
    "footer promise: the buyer pays only after seeing the demo",
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
  "marketplace.slot.launch_demo": ["Open Demo", "button that opens the product's live demo"],
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

  // The home page sections (src/components/sapphire-home and marketplace-home).
  // Every number in these is the catalogue's real count, passed in already
  // formatted for the visitor's language.
  "marketplace.home.solutions_count": [
    "{count} Solutions",
    "feature strip: how many products the catalogue holds",
  ],
  "marketplace.home.solutions": [
    "Software Solutions",
    "feature strip item when the product count could not be read",
  ],
  "marketplace.home.live_demos_count": [
    "{count} Live Demos",
    "feature strip: how many products have a live demo",
  ],
  "marketplace.home.live_demos": [
    "Live Demos",
    "feature strip item when the live-demo count could not be read",
  ],
  "marketplace.home.footer_categories": [
    "{count} Categories",
    "footer line: number of catalogue categories",
  ],
  "marketplace.home.footer_solutions_count": [
    "{count} Software Solutions",
    "footer line: number of products",
  ],
  "marketplace.home.footer_live_demos_count": [
    "{count} Live Demos Ready",
    "footer line: number of live demos",
  ],
  "marketplace.home.footer_live_demos": [
    "Live Demos Ready",
    "footer line when the live-demo count could not be read",
  ],
  "marketplace.home.card_features": [
    "Features",
    "product card stat label: number of features (noun)",
  ],
  "marketplace.home.card_demo": [
    "Demo",
    "product card stat label: whether the demo is live (noun)",
  ],
  "marketplace.home.card_demo_live": ["Live", "product card stat value: the demo is live"],
  "marketplace.home.card_demo_soon": ["Soon", "product card stat value: the demo is coming soon"],
  "marketplace.home.card_delivery": ["Delivery", "product card stat label: delivery time (noun)"],
  "marketplace.home.card_delivery_value": [
    "2h",
    "product card stat value: delivered within two hours",
  ],
  "marketplace.home.products_count": [
    "{count} products",
    "industry tile: number of products in that industry",
  ],
  "marketplace.home.ai_picks_count": "Personalised picks from {count} products.",
  "marketplace.home.ai_picks": "Personalised picks from the full catalogue.",
  "marketplace.home.enterprise_products": [
    "Software Products",
    "enterprise tile label under the product count",
  ],
  "marketplace.home.activity_loading": "Reading the marketplace…",
  "marketplace.home.activity_empty": "Nothing has happened in the marketplace just yet.",
  "marketplace.home.activity_someone": [
    "Someone",
    "anonymous visitor at the start of an activity line, e.g. 'Someone viewed X'",
  ],
  "marketplace.home.views_count": ["{views} views", "number of times a film was watched"],
  "marketplace.home.film_unpublished": [
    "Film not published yet",
    "shown on a video card with no playable URL",
  ],

  // The product page's own not-found screen.
  "marketplace.product.not_found_title": [
    "Product Not Found",
    "heading when a product URL matches nothing",
  ],
  "marketplace.product.not_found_body": 'The product with slug "{slug}" could not be found.',
  "marketplace.product.back": ["Back to Marketplace", "link back to the marketplace home"],

  // The Vala TV page (src/routes/vala-tv.tsx).
  "marketplace.valatv.back": ["← Back to marketplace", "link at the top of the Vala TV page"],
  "marketplace.valatv.subtitle": "Demos, walkthroughs and customer films.",
  "marketplace.valatv.channel": [
    "Watch the whole channel on YouTube",
    "button linking to the YouTube channel",
  ],
  "marketplace.valatv.empty": "No films are published here yet.",
  "marketplace.valatv.category_empty": "No films in that category yet.",
  "marketplace.valatv.categories_label": [
    "Video categories",
    "accessible label of the category tabs",
  ],
  "marketplace.software_vala_2f5584": "Software Vala",
  "marketplace.the_name_of_trust_1a15d4": "- The Name of Trust",
  "marketplace.search_software_4df137": "Search software...",
  "marketplace.search_the_product_catalogue_323c98": "Search the product catalogue",
  "marketplace.api_a_valid_product_id_is_required_cce3624": "A valid product_id is required",
  "marketplace.api_could_not_load_product_files_6e01d1c": "Could not load product files",
  "marketplace.api_product_file_storage_is_not_configured_494fece": "Product file storage is not configured",
  "marketplace.api_a_uuid_idempotency_key_is_required_a1fdf18": "A UUID Idempotency-Key is required",
  "marketplace.api_files_must_be_50_mib_or_smaller_c7e8636": "Files must be 50 MiB or smaller",
  "marketplace.api_invalid_multipart_upload_da04f33": "Invalid multipart upload",
  "marketplace.api_a_valid_product_id_and_file_are_required_cd08689": "A valid product_id and file are required",
  "marketplace.api_files_must_be_between_1_byte_and_50_mib_d15d68e": "Files must be between 1 byte and 50 MiB",
  "marketplace.api_this_file_type_is_not_supported_210338e": "This file type is not supported",
  "marketplace.api_files_can_only_be_added_to_an_editable_pro_e41dad3": "Files can only be added to an editable product",
  "marketplace.api_could_not_verify_the_upload_request_a8e0ff2": "Could not verify the upload request",
  "marketplace.api_idempotency_key_was_already_used_for_anoth_ae83ee1": "Idempotency-Key was already used for another product",
  "marketplace.api_the_file_could_not_be_stored_12f68ec": "The file could not be stored",
  "marketplace.api_file_metadata_could_not_be_saved_e2d8e5b": "File metadata could not be saved",
  "marketplace.api_file_creation_could_not_be_verified_e97e9f7": "File creation could not be verified",
  "marketplace.api_upload_could_not_be_audited_the_file_was_r_6f16608": "Upload could not be audited; the file was rolled back",
  "marketplace.api_expected_a_json_download_request_1585b6a": "Expected a JSON download request",
  "marketplace.api_invalid_product_file_download_request_1ee2fdd": "Invalid product file download request",
  "marketplace.api_could_not_verify_file_ownership_a6bda5e": "Could not verify file ownership",
  "marketplace.api_product_file_not_found_1eab97b": "Product file not found",
  "marketplace.api_could_not_verify_product_ownership_5a5b56d": "Could not verify product ownership",
  "marketplace.api_a_private_download_link_could_not_be_creat_9abe6a6": "A private download link could not be created",
  "marketplace.api_storage_did_not_return_a_signed_download_l_d725a2b": "Storage did not return a signed download link",
  "marketplace.api_download_could_not_be_audited_e2af156": "Download could not be audited",
  "marketplace.api_catalogue_is_not_configured_961bc7f": "Catalogue is not configured",
  "marketplace.api_invalid_search_offset_f484d6e": "Invalid search offset",
  "marketplace.api_search_is_unavailable_9a0fa23": "Search is unavailable",
} as const;
