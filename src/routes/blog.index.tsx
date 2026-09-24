import { createFileRoute, Link, useLoaderData } from "@tanstack/react-router";
import { useTranslation } from "@/lib/i18n/use-translation";
import { ArrowLeft, FileText } from "lucide-react";

import { absoluteUrl } from "@/lib/seo/site-url";
import { getBlogIndex } from "@/lib/seo/blog.functions";
import { blogExcerpt } from "@/lib/seo/blog";
import type { BlogIndex } from "@/lib/seo/blog";

/**
 * The blog index.
 *
 * The SEO Manager has been able to write, review and publish articles into
 * seo_content_items since it was built, and /blog answered 404 the whole time,
 * so nothing it published was ever readable. This is the page those articles
 * have been waiting for.
 *
 * Only a post with a body is listed. A row marked published with nothing
 * stored in it would be an empty page wearing a title, so it is held back
 * rather than dressed up, and while there is nothing to read the page says so
 * and asks not to be indexed.
 */

export const Route = createFileRoute("/blog/")({
  loader: async (): Promise<BlogIndex> => {
    try {
      return await getBlogIndex();
    } catch (error) {
      console.error("[blog index] could not load", error);
      return { posts: [], withoutBody: 0 };
    }
  },

  head: ({ loaderData }) => {
    const data = (loaderData ?? { posts: [], withoutBody: 0 }) as BlogIndex;
    const title = "Blog — Software Vala";
    const description =
      "Guides on choosing, buying and running business software, from the Software Vala team.";
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
    ];
    // An index with nothing in it is not worth a place in the index.
    if (!data.posts.length) {
      meta.push({ name: "robots", content: "noindex, follow" });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: absoluteUrl("/blog") }],
    };
  },

  component: BlogIndexPage,
});

function BlogIndexPage() {
  const data = useLoaderData({ from: "/blog/" });
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("blog.back_to_site")}
        </Link>
      </div>

      <header className="px-6 py-10">
        <h1 className="text-3xl font-black sm:text-4xl">{t("blog.title")}</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70">{t("blog.tagline")}</p>
      </header>

      <section className="px-6 pb-16">
        {data.posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white/80">
              <FileText className="h-4 w-4 text-white/40" />
              {t("blog.empty_title")}
            </p>
            <p className="mt-2 max-w-xl text-sm text-white/60">{t("blog.empty_body")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.posts.map((post) => (
              <Link
                key={post.id}
                to="/blog/$slug"
                params={{ slug: post.slug }}
                className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
              >
                <FileText className="h-6 w-6 text-white/40" aria-hidden="true" />
                <span className="mt-3 text-base font-bold">{post.title}</span>
                <span className="mt-2 text-sm text-white/60">{blogExcerpt(post.body, 140)}</span>
                {post.publishedAt && (
                  <span className="mt-3 text-xs text-white/40">
                    {post.publishedAt.slice(0, 10)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
