import { studioOperator } from "@/lib/vala-ai/studio/auth.functions";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_SITE_HTML_CHARACTERS, siteHtmlLimit, siteHtmlWarning } from "../site-output";

const COLORS =
  "--primary, --primary-foreground, --accent, --bg, --fg, --muted, --card, --hero-from, --hero-to";

export const generateSiteFn = createServerFn({ method: "POST" })
  .middleware([studioOperator])
  .inputValidator((d: unknown) =>
    z
      .object({
        request: z.string().trim().min(1).max(4000),
        pageType: z.string().max(60).optional(),
        previousHtml: z.string().max(MAX_SITE_HTML_CHARACTERS).optional(),
        maxCharacters: z.number().int().min(1).max(MAX_SITE_HTML_CHARACTERS).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { structured } = await import("./agent.server");
    const maxCharacters = siteHtmlLimit(data.request, data.maxCharacters);
    const checked = (site: { title: string; html: string; reply: string }) => {
      const warning = siteHtmlWarning(site.html, maxCharacters);
      if (warning)
        console.warn("[Vala AI Builder] HTML character limit exceeded", {
          characters: site.html.length,
          maxCharacters,
        });
      return { ...site, warning, htmlCharacters: site.html.length, maxCharacters };
    };
    if (data.previousHtml) {
      // Edits: ask only for small find/replace patches instead of the whole page — much faster.
      const schema = z.object({
        reply: z.string(),
        edits: z.array(z.object({ find: z.string(), replace: z.string() })),
      });
      const { out } = await structured(
        schema,
        `You edit an existing single-file HTML website. The final HTML must be at most ${maxCharacters} characters including markup and whitespace. Return the SMALLEST set of edits. Each "find" must be an exact, unique substring copied verbatim from the HTML (include enough surrounding text to be unique); "replace" is its new text. To add a section, find a closing tag like the end of a nearby section and replace it with itself plus the new markup. Keep colors on CSS variables (${COLORS}). "reply" is one short sentence in the user's language.`,
        `CHANGE REQUEST: ${data.request}\n\nHTML:\n${data.previousHtml}`,
      );
      let html = data.previousHtml,
        applied = 0;
      for (const e of out.edits)
        if (e.find && html.includes(e.find)) {
          html = html.replace(e.find, e.replace);
          applied++;
        }
      if (applied) return checked({ title: "", html, reply: out.reply });
    }
    const schema = z.object({ title: z.string(), html: z.string().min(1), reply: z.string() });
    const instructions = `You build complete single-file websites. Return one full HTML document (inline <style>, optional inline <script>, no external JS; Google Fonts links allowed; images only from https://images.unsplash.com or none).
Colors MUST come from these CSS variables defined in :root with sensible defaults, and every colored element must use them: ${COLORS}. Responsive, polished, real copy (no lorem ipsum).
The HTML must be at most ${maxCharacters} characters, including markup and whitespace. ${maxCharacters < MAX_SITE_HTML_CHARACTERS ? "Use minimal markup and compact inline CSS; omit unnecessary whitespace and features to respect this limit." : "Keep it concise (about 250 lines)."}
${data.pageType ? `Page type: ${data.pageType}.` : ""}
If PREVIOUS HTML is given, apply the user's change to it and keep everything else. "reply" is one short sentence in the user's language.`;
    const prompt = data.previousHtml
      ? `CHANGE REQUEST: ${data.request}\n\nPREVIOUS HTML:\n${data.previousHtml}`
      : data.request;
    const { out } = await structured(schema, instructions, prompt);
    return checked(out);
  });
