type DemoLinkSource = {
  hasDemo?: boolean;
  slug?: string;
  url?: string;
};

export function marketplaceDemoHref({ hasDemo, slug, url }: DemoLinkSource): string | null {
  if (hasDemo && slug) return `/demo/${encodeURIComponent(slug)}`;
  return url?.startsWith("/demo/") ? url : null;
}

export function demoNumbersInRow(
  cards: readonly { hasDemo: boolean; id?: string }[],
  startAfter = 0,
): Array<number | null> {
  let number = startAfter;
  const seen = new Set<string>();
  return cards.map((card) => {
    if (!card.hasDemo || (card.id !== undefined && seen.has(card.id))) return null;
    if (card.id !== undefined) seen.add(card.id);
    return ++number;
  });
}

export function demoNumbersForCards(
  cards: readonly (DemoLinkSource & { id: string; status: "ACTIVE" | "COMING_SOON" })[],
  startAfter = 0,
): Array<number | null> {
  return demoNumbersInRow(
    cards.map((card) => ({
      id: card.id,
      hasDemo: card.status === "ACTIVE" && marketplaceDemoHref({ ...card, hasDemo: true }) !== null,
    })),
    startAfter,
  );
}
