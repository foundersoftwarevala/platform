import { createServerFn } from "@tanstack/react-start";

import { readBlogIndex, readBlogPost, type BlogIndex, type BlogPost } from "./blog";

/**
 * The blog, resolved on the server.
 *
 * blog.ts reads with the service role, so going through a server function is
 * what keeps it out of the browser bundle and makes the lookup work during a
 * client-side navigation as well as a cold load.
 */

export const getBlogIndex = createServerFn({ method: "GET" }).handler(
  async (): Promise<BlogIndex> => {
    try {
      return await readBlogIndex();
    } catch (error) {
      console.error("[blog] could not read the index", error);
      return { posts: [], withoutBody: 0 };
    }
  },
);

export const getBlogPost = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { slug: string })
  .handler(async ({ data }): Promise<BlogPost | null> => {
    try {
      return await readBlogPost(data.slug);
    } catch (error) {
      console.error("[blog] could not read", data.slug, error);
      return null;
    }
  });
