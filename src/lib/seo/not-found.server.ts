import { createServerOnlyFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";

/**
 * Answer 404 for a page whose lookup worked and found nothing, while the page
 * itself still renders.
 *
 * Product, category, country and slot pages already told a missing slug apart
 * from a failed lookup and marked it noindex, but the response stayed 200 -
 * a soft 404 that crawlers keep requesting. `throw notFound()` would swap the
 * page's own "not found" screen for the generic one, and that screen is part
 * of the design, so only the status changes.
 *
 * Server-only: route loaders also run in the browser on a client-side
 * navigation, where there is no response to set, and the server module must
 * not reach the client bundle at all.
 */
export const respondNotFound = createServerOnlyFn((): void => {
  try {
    setResponseStatus(404);
  } catch {
    /* outside a request (a test) there is nothing to set */
  }
});
