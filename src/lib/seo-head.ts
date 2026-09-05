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
