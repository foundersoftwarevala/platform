import { absoluteUrl } from "@/lib/seo/site-url";

/** Shared head() builder so every SEO Manager route ships unique metadata. */
export function seoHead(path: string, title: string, description: string) {
  const full = `${title} · Software Vala SEO Manager`;
  return () => ({
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: path },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: path }],
  });
}

/**
 * Head for an ordinary page. The brand carries the trademark and sits after the
 * page name, so a browser tab that is too narrow to show all of it still shows
 * the part that tells you which page you are on.
 */
export function pageHead(title: string, description: string, path?: string) {
  const full = `${title} \u2014 Software Vala\u2122`;
  // A page that says which URL it is. Nine of the ten pages this site
  // advertises in sitemap-pages.xml carried no canonical at all - only the home
  // page had one - because this helper never emitted it, and twenty-three
  // routes share this helper. The path is optional so the manager and admin
  // routes that also use it are unaffected: they are not advertised anywhere
  // and have no canonical to declare.
  const canonical = path ? absoluteUrl(path) : null;
  return () => ({
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(canonical ? [{ property: "og:url", content: canonical }] : []),
      { name: "twitter:card", content: "summary_large_image" },
    ],
    ...(canonical ? { links: [{ rel: "canonical", href: canonical }] } : {}),
  });
}
