import { createFileRoute } from "@tanstack/react-router";

/**
 * GET /api/i18n/languages
 *
 * The languages an operator has switched off (i18n_languages.enabled = false),
 * as registry codes: { "disabled": ["xx", ...] }. The language selector hides
 * them, so a visitor cannot pick a language the service then refuses and be
 * left on an English page with no explanation. Public: it says nothing more
 * than which languages the selector offers. Cached for a minute.
 */
export const Route = createFileRoute("/api/i18n/languages")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { db, disabledLanguages } = await import("@/lib/i18n/service.server");
          const disabled = [...(await disabledLanguages(db()))].sort();
          return Response.json(
            { disabled },
            { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=60" } },
          );
        } catch (error) {
          console.error("[i18n] language list failed", error);
          // Nothing known to be off: the selector shows every language, as before.
          return Response.json({ disabled: [] }, { headers: { "Cache-Control": "no-store" } });
        }
      },
    },
  },
});
