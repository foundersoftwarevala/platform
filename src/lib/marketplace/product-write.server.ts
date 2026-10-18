import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/integrations/supabase/types";
import { logProductReview, productCreationReview, productReviewFields } from "./product-safety";

/** The caller must authorize catalogue editing before calling this writer. */
export async function upsertReviewedProduct(
  client: SupabaseClient<Database>,
  data: TablesInsert<"marketplace_products">,
) {
  const { data: existing, error: lookupError } = await client
    .from("marketplace_products")
    .select("id")
    .eq("slug", data.slug)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);
  const review = existing ? null : productCreationReview(data.name);
  const values = { ...data, ...(review ? productReviewFields(review) : {}) };
  // A concurrent create must not turn a QA insert into an update of an existing product.
  const write = review?.review_required
    ? client.from("marketplace_products").insert(values)
    : client.from("marketplace_products").upsert(values, { onConflict: "slug" });
  const { data: row, error } = await write.select().single();
  if (error) throw new Error(error.message);
  if (!row?.id) throw new Error("Product write could not be verified");
  if (review) logProductReview(review, "catalogue upsert", row.id);
  return row;
}
