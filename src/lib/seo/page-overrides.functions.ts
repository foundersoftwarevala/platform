import { createServerFn } from "@tanstack/react-start";

import { resolveSeoOverride, type SeoOverride } from "./page-overrides";

/**
 * What the SEO Manager says about a page, resolved on the server.
 *
 * page-overrides.ts reads seo_pages and seo_meta_rules with the service role,
 * so it can only ever work on the server. It was imported straight into the
 * product route, whose loader runs in the browser as well during a
 * client-side navigation, and that had two consequences:
 *
 *   - the module was compiled into the browser bundle, where
 *     process.env.SUPABASE_SERVICE_ROLE_KEY is replaced with nothing, so the
 *     lookup returned null and every hand-written title, description and
 *     canonical was quietly ignored on any navigation that did not reload the
 *     page. An operator's override worked on a cold load and not afterwards.
 *   - server-only code shipped to visitors. No secret went with it - the key
 *     is not in the bundle, it is compiled to undefined - but the code had no
 *     business being there.
 *
 * Going through a server function fixes both: the resolution always happens
 * where the credentials are, and the module stays out of the browser.
 */
export const getSeoOverride = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as {
    path: string;
    variables?: Record<string, string | undefined>;
  })
  .handler(async ({ data }): Promise<SeoOverride | null> => {
    try {
      return await resolveSeoOverride(data.path, data.variables ?? {});
    } catch (error) {
      // The page must never fail because its SEO record could not be read.
      console.error("[seo override] could not resolve", data.path, error);
      return null;
    }
  });
