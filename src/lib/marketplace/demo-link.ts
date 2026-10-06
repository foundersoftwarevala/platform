type DemoLinkSource = {
  hasDemo?: boolean;
  slug?: string;
  url?: string;
};

export function marketplaceDemoHref({ hasDemo, slug, url }: DemoLinkSource): string | null {
  if (hasDemo && slug) return `/demo/${encodeURIComponent(slug)}`;
  return url?.startsWith("/demo/") ? url : null;
}
