/**
 * Shared interface primitives (src/components/ui): dialogs, sheets, pagination,
 * carousels, breadcrumbs, the sidebar. Mostly screen-reader text. English only.
 */
export const COMMON_MESSAGES = {
  "common.language_native_sign_in": "Sign in to the native Language Manager",
  "common.language_native_email": "Account email",
  "common.language_native_password": "Account password",
  "common.language_native_note":
    "Language administration uses the canonical VPS account database. MFA and SSO accounts require their secured authentication flow.",
  "common.language_partial":
    "Some text is awaiting translation or review. The source language is shown where a translation is unavailable.",
  "common.language_origin_refused": "Same-origin request required.",
  "common.language_sign_in_refused":
    "Sign-in refused. This native password flow does not bypass MFA or SSO.",
  "common.language_sign_out": "Sign out of Language Manager",
  "common.language_native_user_session":
    "Your language session is active for private chat translation. Language administration requires a separate operator role.",
  "common.close": ["Close", "closes a dialog or panel"],
  "common.dismiss_announcement": [
    "Dismiss announcement",
    "closes the rotating marketplace announcement banner",
  ],
  "common.weather_forecast_scroll": [
    "Hourly and daily weather forecast",
    "accessible name for the horizontally scrolling weather forecast",
  ],
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
  "common.skip_to_content": [
    "Skip to main content",
    "keyboard link that jumps past the menus to the page content",
  ],
  "common.language_change_delay": [
    "Changes here reach visitors within about two minutes: each server keeps its own copy of the language list and language packs for a minute, and browsers for another minute.",
    "note in the Language Manager about how long an enabled/disabled language or an approved translation takes to show",
  ],
  "common.translation_paused": [
    "Translation is paused for a moment; the page stays in English until it resumes.",
    "shown in the language selector while the translation engine is not answering",
  ],
  "common.language_manager_refused": [
    "The Language Manager service refused this session: {reason} Its data needs a signed-in admin or boss account that the server accepts.",
    "error in the Language Manager when the server refuses the signed-in account; {reason} is the server's own message",
  ],
} as const;
