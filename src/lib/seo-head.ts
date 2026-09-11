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
  return () => ({
    meta: [
      { title: full },
      { name: "description", content: description },
      { property: "og:title", content: full },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    // A page that names its own path also gets a canonical on the configured
    // site address. Optional, so every existing caller - and any layout route,
    // whose children set their own canonical - keeps exactly the head it had.
    ...(path ? { links: [{ rel: "canonical", href: absoluteUrl(path) }] } : {}),
  });
}
