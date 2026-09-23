import { createFileRoute } from "@tanstack/react-router";

import { SlidingWindowLimiter, clientAddress } from "@/lib/i18n/limits";
import { SOURCE_LANGUAGE, getLanguage, resolveLanguage } from "@/lib/i18n/registry";

/**
 * GET /api/i18n/pack?lang=he
 *
 * The interface strings translation memory already holds for one language,
 * as one JSON object keyed like the browser keeps them (context, U+0001,
 * source text). A page loads it once when a language is shown and asks the
 * translation endpoint only for what it does not contain - one request per
 * page view instead of a batch per screenful, and none at all once memory
 * holds the page.
 *
 * The response is built from translation memory: text only from servable
 * rows (machine, verified) of the "ui" namespace, plus the strings held for
 * review listed under `withheld` without text, so the page stops asking for
 * them. It is kept in the server process for five minutes and marked
 * cacheable so browsers and any shared cache in front can keep it too. It
 * contains nothing that is not already public: the same text the page shows.
 */

const limiter = new SlidingWindowLimiter(60_000);
const REQUESTS_PER_MINUTE = 120;

const EMPTY_SOURCE = new Set([SOURCE_LANGUAGE]);

function isSourceVariety(code: string): boolean {
  const language = getLanguage(code);
  const source = getLanguage(SOURCE_LANGUAGE);
  return Boolean(
    language &&
    source &&
    language.iso639_3 === source.iso639_3 &&
    language.script === source.script,
  );
}

export const Route = createFileRoute("/api/i18n/pack")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const started = performance.now();
        const { count, observe } = await import("@/lib/i18n/metrics.server");
        const finish = (response: Response) => {
          observe("api.pack", performance.now() - started);
          count(`api.pack.${response.status}`);
          return response;
        };

        const requested = new URL(request.url).searchParams.get("lang") ?? "";
        const language = resolveLanguage(requested.slice(0, 64));
        if (!language) {
          return finish(
            Response.json(
              { error: "Unsupported language.", reason: "invalid_language" },
              { status: 400 },
            ),
          );
        }
        if (limiter.hit(clientAddress(request.headers), REQUESTS_PER_MINUTE)) {
          return finish(
            Response.json(
              { error: "Too many requests.", reason: "rate_limited" },
              { status: 429, headers: { "Retry-After": "60" } },
            ),
          );
        }

        const headers = {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        };
        if (EMPTY_SOURCE.has(language.code) || isSourceVariety(language.code)) {
          return finish(
            new Response(JSON.stringify({ lang: language.code, count: 0, entries: {} }), {
              headers,
            }),
          );
        }

        try {
          const { languagePack } = await import("@/lib/i18n/service.server");
          const pack = await languagePack(language.code);
          if (request.headers.get("if-none-match") === pack.etag) {
            return finish(
              new Response(null, { status: 304, headers: { ...headers, ETag: pack.etag } }),
            );
          }
          return finish(new Response(pack.body, { headers: { ...headers, ETag: pack.etag } }));
        } catch (error) {
          console.error("[i18n] language pack failed", error);
          return finish(
            Response.json(
              { error: "Translations are not available right now.", reason: "service_error" },
              { status: 503, headers: { "Retry-After": "30" } },
            ),
          );
        }
      },
    },
  },
});
