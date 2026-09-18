import { createFileRoute } from "@tanstack/react-router";

import { LanguageManagerConsole } from "@/components/language-manager/LanguageManagerConsole";
import { pageHead } from "@/lib/seo-head";

export const Route = createFileRoute("/language-manager")({
  head: () =>
    pageHead("Language Manager", "Languages, translation engine, memory, glossary and review."),
  component: LanguageManagerConsole,
});
