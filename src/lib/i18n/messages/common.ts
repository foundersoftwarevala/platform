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

  // The language selector (src/components/i18n/LanguageSelector.tsx)
  "common.language": ["Language", "heading of the list of interface languages"],
  "common.language_choose": "Language: {language}. Choose another language",
  "common.language_search": "Search languages",
  "common.language_jump": "Jump to letter",
  "common.language_suggested": [
    "Current and suggested",
    "heading above the current and browser languages",
  ],
  "common.language_all": "{count, plural, one {All languages (#)} other {All languages (#)}}",
  "common.language_none": "No language matches “{query}”",
  "common.language_manage": ["Manage", "opens the Language Manager"],
  "common.language_on": ["On", "the language is switched on"],
  "common.language_off": ["Off", "the language is switched off"],
} as const;
