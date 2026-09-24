import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ArrowLeft } from "lucide-react";

import { absoluteUrl } from "@/lib/seo/site-url";
import { getBlogPost } from "@/lib/seo/blog.functions";
import { blogBlocks, blogExcerpt } from "@/lib/seo/blog";
import type { BlogPost } from "@/lib/seo/blog";

/**
 * One article.
 *
 * The body is drawn as elements built from the stored text, never handed to the
 * browser as markup, so nothing an author writes can put a script into a
 * reader's page.
 *
 * A post that is not published, or that has no body stored, is not shown at
 * all: the page says the article is not available and asks not to be indexed,
 * rather than rendering a headline over nothing.
 */

type Loaded = { post: BlogPost | null };

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params }): Promise<Loaded> => {
    try {
      return { post: await getBlogPost({ data: { slug: params.slug } }) };
    } catch (error) {
      console.error("[blog post] could not load", params.slug, error);
      return { post: null };
    }
  },

  head: ({ loaderData }) => {
    const post = (loaderData as Loaded | undefined)?.post ?? null;
    if (!post) {
      return {
        meta: [
          { title: "Article — Software Vala" },
          { name: "robots", content: "noindex, follow" },
        ],
      };
    }

    const canonical = absoluteUrl(post.url);
    const description = blogExcerpt(post.body);
    const title = `${post.title} | Software Vala`;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        ...(post.keyword ? [{ name: "keywords", content: post.keyword }] : []),
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description,
            url: canonical,
            wordCount: post.wordCount || undefined,
            ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
            ...(post.updatedAt ? { dateModified: post.updatedAt } : {}),
            publisher: { "@type": "Organization", name: "Software Vala" },
          }),
        },
      ],
    };
  },

  component: BlogPostPage,
});

function BlogPostPage() {
  const { post } = useLoaderData({ from: "/blog/$slug" });
  const { t } = useTranslation();

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-20 text-center text-white">
        <p className="text-sm text-white/70">{t("blog.not_available")}</p>
        <Link to="/blog" className="mt-4 inline-block text-sm font-semibold text-cyan-300">
          {t("blog.back_to_index")}
        </Link>
      </div>
    );
  }

  const blocks = blogBlocks(post.body);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-4">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("blog.title")}
        </Link>
      </div>

      <article className="px-6 py-10">
        <h1 className="max-w-3xl text-3xl font-black sm:text-4xl">{post.title}</h1>
        {post.publishedAt && (
          <p className="mt-3 text-xs text-white/40">{post.publishedAt.slice(0, 10)}</p>
        )}

        <div className="mt-8 max-w-3xl space-y-4">
          {blocks.map((block, index) => {
            if (block.kind === "heading") {
              return block.level === 2 ? (
                <h2 key={index} className="pt-4 text-xl font-bold text-white">
                  {block.text}
                </h2>
              ) : (
                <h3 key={index} className="pt-3 text-base font-bold text-white/90">
                  {block.text}
                </h3>
              );
            }
            if (block.kind === "item") {
              return (
                <p key={index} className="pl-4 text-sm leading-relaxed text-white/75">
                  · {block.text}
                </p>
              );
            }
            return (
              <p key={index} className="text-sm leading-relaxed text-white/75">
                {block.text}
              </p>
            );
          })}
        </div>
      </article>
    </div>
  );
}
