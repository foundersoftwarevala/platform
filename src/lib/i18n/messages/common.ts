/**
 * Shared interface primitives (src/components/ui): dialogs, sheets, pagination,
 * carousels, breadcrumbs, the sidebar. Mostly screen-reader text. English only.
 */
export const COMMON_MESSAGES = {
  "common.close": ["Close", "closes a dialog or panel"],
  "common.pagination": ["Pagination", "name of the page navigation for screen readers"],
  "common.previous_page": "Go to previous page",
  "common.next_page": "Go to next page",
  "common.previous": ["Previous", "previous page"],
  "common.next": ["Next", "next page"],
  "common.more_pages": "More pages",
  "common.previous_slide": "Previous slide",
  "common.next_slide": "Next slide",
  "common.breadcrumb": ["Breadcrumb", "name of the breadcrumb navigation for screen readers"],
  "common.more": ["More", "more breadcrumb levels are hidden"],
  "common.sidebar": ["Sidebar", "title of the mobile sidebar panel"],
  "common.sidebar_description": "Displays the mobile sidebar.",
  "common.toggle_sidebar": "Toggle sidebar",
} as const;
