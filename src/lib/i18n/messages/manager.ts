/**
 * The operator consoles: the SEO Centre, the Marketplace Manager's live
 * modules, the Orders wall, the Finance ledger and the AMS role engine.
 * English only.
 *
 * These screens are read by the people who run the platform rather than by
 * buyers, but they are read in whatever language that person works in, so the
 * text belongs here like any other. Database table and column names are not
 * here: those are identifiers, and an identifier that has been translated no
 * longer names anything.
 */
export const MANAGER_MESSAGES = {
  // SEO: the entity graph, the link engine and the opportunity list.
  "manager.seo.entity_no_page": ["no page", "shown when an entity has no URL of its own"],
  "manager.seo.entity_derived": ["derived", "shown when an entity came from no single table"],
  "manager.seo.entity_graph": ["Entity graph", "heading of the SEO entity graph screen"],
  "manager.seo.entity_graph_note": [
    "Categories, cards, products, countries, regions, industries and the pages that represent them, each derived from a row that already existed and each relationship naming the column that proved it.",
    "what the entity graph screen shows",
  ],
  "manager.seo.entities": ["Entities", "count of things in the SEO entity graph"],
  "manager.seo.relationships": ["Relationships", "count of edges in the SEO entity graph"],
  "manager.seo.all_with_evidence": ["all with evidence", "note under the relationship count"],
  "manager.seo.cards": ["Cards", "count of marketplace card slots"],
  "manager.seo.products": ["Products", "count of products"],
  "manager.seo.relationships_and_proof": [
    "Relationships, and what proved each",
    "heading over the evidence table",
  ],
  "manager.seo.internal_links": [
    "Link recommendations",
    "heading of the link recommendation screen - not the internal link audit, which is a different screen",
  ],
  "manager.seo.internal_links_note": [
    "Derived from the entity graph, capped at a handful per page, and refused where the target is a page the gate holds back. Nothing has been published: each of these is an argument waiting to be accepted or refused.",
    "what the internal link screen shows",
  ],
  "manager.seo.recommendations": ["Recommendations", "count of proposed internal links"],
  "manager.seo.awaiting_review": ["Awaiting review", "links proposed but not yet accepted"],
  "manager.seo.nothing_published_yet": [
    "nothing published yet",
    "note under the awaiting-review count",
  ],
  "manager.seo.published_links": ["Published", "links that have been accepted and applied"],
  "manager.seo.highest_priority": ["Highest priority", "the strongest link recommendations"],
  "manager.seo.same_ecosystem": ["same ecosystem", "note under the highest-priority count"],
  "manager.seo.opportunities": ["Opportunities", "heading of the SEO opportunity screen"],
  "manager.seo.opportunities_note": [
    "Each derived from evidence already on this platform: page scores, the indexing gate, the entity graph, the link engine and Lead Manager. Anonymous traffic is not a lead and is not counted as one here.",
    "what the opportunity screen shows",
  ],
  "manager.seo.open": ["Open", "opportunities not yet dealt with"],
  "manager.seo.critical": ["Critical", "most severe opportunities"],
  "manager.seo.high": ["High", "high severity opportunities"],
  "manager.seo.cannot_judge_yet": [
    "Cannot be judged yet",
    "opportunities blocked for want of search data",
  ],
  "manager.seo.needs_search_data": ["needs search data", "why an opportunity cannot be judged"],
  // Lead Manager: where a lead came from.
  "manager.lead.attribution": ["Attribution", "heading over where a lead came from"],
  "manager.lead.attribution_none":
    "Nothing was recorded for this lead - it was captured before attribution was wired, or the visitor arrived with no referrer and no campaign.",
  // Finance ledger.
  "manager.finance.ledger": ["Ledger", "the tab and heading over the finance tables"],
  "manager.finance.ledger_title": "The money that has moved",
  "manager.finance.ledger_note":
    "Read from the finance tables themselves. An amount is what happened and cannot be edited here; what an operator decides is whether it is approved, rejected or settled.",

  // AMS role engine.
  "manager.ams.no_ladder": ["no ladder recorded", "a role with no XP stages stored"],
  "manager.ams.ends_at": ["· ends at {title}", "the last stage of a role's XP ladder"],

  // The live modules, whose titles name the thing each one manages.
  "manager.module.product_media": "Product Media",
  "manager.module.demo_system": "Demo System",
  "manager.module.blog": "Blog",
  "manager.module.license": "License",
  "manager.module.downloads": "Downloads",
  "manager.module.authors": "Authors",
  "manager.module.vendors": "Vendors",
  "manager.module.resellers": "Resellers",
  "manager.module.affiliate": "Affiliate",
  "manager.module.influencer": "Influencer",
  "manager.module.qr_system": "QR System",
  "manager.module.reports": "Reports",

  // The orders wall.
  "manager.orders.title": "Orders",
  "manager.orders.paid": "Paid",
  "manager.orders.refunded": "Refunded",
  "manager.orders.awaiting": "Awaiting payment",
  "manager.orders.invoices": "Invoices",
  "manager.orders.payment_log": "Payment log",
  "manager.orders.refunds": "Refunds",
  "manager.orders.returns": "Returns",
  "manager.orders.endpoint_note_before": "Every tab above reads the real table through",
  "manager.orders.endpoint_note_after":
    ". An order's money is never editable from a screen; what an operator may change is its state.",

  // The home page's chat button.
  "manager.home.open_chat": ["Open Connect Chat", "the button that opens the chat panel"],
  "manager.home.chat_with_us": "Chat with us",
} as const;
