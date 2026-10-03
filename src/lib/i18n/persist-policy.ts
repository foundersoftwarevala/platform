import type { CallerTier } from "./limits";

/**
 * What a translation request may write to shared memory, and which engines may
 * see its text. Pure, so it is tested without a server (see
 * __tests__/persist-policy.test.ts); service.server.ts applies it.
 *
 * Namespace "ui" is page text: whatever is on someone's screen, including an
 * operator's dashboard with customers' names, e-mail addresses and amounts.
 * Only the interface catalogue is ever kept from it, whoever is looking. Other
 * text reaches shared memory only through explicit operator actions
 * (enqueue_texts and the job queue), or as an operator's non-page namespace.
 *
 * Returns the mayPersist predicate for the pipeline; undefined means "keep
 * everything the quality gate passes".
 */
export function persistenceRule(
  namespace: string,
  tier: CallerTier,
  isCatalogue: (text: string) => boolean,
): ((text: string) => boolean) | undefined {
  if (namespace === "ui" || tier !== "operator") {
    return (text: string) => namespace === "ui" && isCatalogue(text);
  }
  return undefined;
}

/**
 * Page text that is not the catalogue never leaves the platform: the external
 * AI adapter is not used for it, even when TRANSLATION_ALLOW_EXTERNAL=true.
 */
export function requiresOwnedEngine(
  namespace: string,
  texts: readonly string[],
  isCatalogue: (text: string) => boolean,
): boolean {
  return namespace === "ui" && texts.some((text) => !isCatalogue(text.trim()));
}
