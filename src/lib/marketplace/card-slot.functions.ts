import { createServerFn } from "@tanstack/react-start";

import { readCardSlot, type CardSlot } from "./card-slot";

/**
 * A card slot, resolved on the server.
 *
 * card-slot.ts reads with the service role, so it can only work on the server.
 * A route loader runs in the browser too during a client-side navigation, so
 * importing the reader straight into one would both break the lookup and ship
 * server-only code to visitors - the mistake page-overrides.functions.ts was
 * written to undo. This keeps it where the credentials are.
 */
export const getCardSlot = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => input as { category: string; country: string })
  .handler(async ({ data }): Promise<CardSlot | null> => {
    try {
      return await readCardSlot(data.category, data.country);
    } catch (error) {
      console.error("[card slot] could not read", data.category, data.country, error);
      return null;
    }
  });
