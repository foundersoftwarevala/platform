import type { Sql } from "postgres";

import staticText from "./ui-source.generated.json";
import { allMessages } from "./messages";
import { UI_DICTIONARY } from "./ui-dictionary";
import { SingleFlight, TtlCache } from "./hot-cache";

export const STATIC_CATALOGUE: ReadonlySet<string> = new Set([
  ...staticText,
  ...Object.keys(UI_DICTIONARY.en ?? {}),
  ...allMessages().map((message) => message.text),
]);

const publicCache = new TtlCache<ReadonlySet<string>>(1);
const publicFlight = new SingleFlight<ReadonlySet<string>>();

export async function publicCatalogue(client: Sql): Promise<ReadonlySet<string>> {
  const cached = publicCache.get("public");
  if (cached) return cached;
  return publicFlight.run("public", async () => {
    const rows = await client<{ source_text: string }[]>`
      select source_text from public.i18n_public_catalogue_texts()
    `;
    const texts = new Set(STATIC_CATALOGUE);
    for (const row of rows) {
      if (typeof row.source_text !== "string") throw new Error("Invalid public catalogue text.");
      const text = row.source_text.trim();
      if (text) texts.add(text);
    }
    publicCache.set("public", texts, 30_000);
    return texts;
  });
}

export function invalidatePublicCatalogue() {
  publicCache.deletePrefix("");
}
