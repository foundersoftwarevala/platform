/** The Language Manager console (src/components/language-manager). English only. */
export const LANGUAGES_MESSAGES = {
  "languages.pretranslate_all": "Pre-translate the catalogue into every language",
  "languages.pretranslate_confirm": [
    "Queue up to {count} translations, about {hours} h of engine time? Strings memory already holds are skipped.",
    "confirmation before queueing the whole catalogue for every language; count is a formatted number",
  ],
  "languages.queue_them": ["Queue them", "confirms queueing the translations"],
  "languages.cancel": ["Cancel", "dismisses the confirmation"],
  "languages.page_range": [
    "{from}–{to} of {total}",
    "position in the review queue, e.g. 51–100 of 340",
  ],
  "languages.failed_jobs": [
    "Failed jobs",
    "heading of the list of background translations that failed",
  ],
  "languages.sync_messages": [
    "Sync keyed messages",
    "queues every keyed interface message for every language",
  ],
  "languages.requeue_failed": "Re-queue all failed",
  "languages.failed_help":
    "Jobs that failed because the engine was down go back to the queue on their own every hour. The rest failed on their own text; re-queue them after fixing the cause.",
  "languages.no_failed_jobs": "No failed jobs.",
  "languages.column_language": ["Language", "table column: target language code"],
  "languages.column_text": ["Text", "table column: the English text"],
  "languages.column_attempts": ["Attempts", "table column: how many times it was tried"],
  "languages.column_error": ["Last error", "table column: why it failed"],
  "languages.choose_to_add": [
    "Choose a language to add",
    "picker of registry languages not yet configured for a feature",
  ],
  "languages.done": ["Done.", "toast after an action with nothing to report"],
} as const;
