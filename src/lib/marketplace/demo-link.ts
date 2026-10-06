type DemoLinkSource = {
  hasDemo?: boolean;
  slug?: string;
  url?: string;
};

export function marketplaceDemoHref({ hasDemo, slug, url }: DemoLinkSource): string | null {
  if (hasDemo && slug) return `/demo/${encodeURIComponent(slug)}`;
  return url?.startsWith("/demo/") ? url : null;
}

export function demoNumbersInRow(cards: readonly { hasDemo: boolean }[]): Array<number | null> {
  let number = 0;
  return cards.map((card) => (card.hasDemo ? ++number : null));
}
