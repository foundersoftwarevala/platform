import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  RESELLER_SEO_COUNTRIES,
  resellerCountryCodeFromDraftBody,
} from "@/lib/reseller-country-seo";

const CONTENT_TYPE = "reseller-country-seo";
const progressSchema = z.object({
  total: z.number().int().nonnegative(),
  queued: z.number().int().nonnegative(),
  processing: z.number().int().nonnegative(),
  retrying: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

async function requireSeoOperator(action: string): Promise<void> {
  const { requireOperator } = await import("@/lib/auth/require-operator.server");
  await requireOperator(action, { alsoAllow: ["seo", "marketing"] });
}

export const queueResellerCountrySeoDrafts = createServerFn({ method: "POST" }).handler(
  async (): Promise<{
    total: number;
    queued: number;
    alreadyQueued: number;
    completed: number;
  }> => {
    await requireSeoOperator("Queueing reseller country SEO drafts");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("seo_content_items")
      .select("id, body, status")
      .eq("content_type", CONTENT_TYPE)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(`Existing reseller SEO drafts could not be read: ${error.message}`);

    const countryRows = new Map<string, { id: string; status: string }>();
    for (const row of rows ?? []) {
      const code = resellerCountryCodeFromDraftBody(row.body);
      if (code && !countryRows.has(code)) countryRows.set(code, { id: row.id, status: row.status });
    }

    const newRows: Array<{
      title: string;
      content_type: string;
      target_keyword: string;
      body: string;
      status: string;
    }> = [];
    const retryRows: Array<{ id: string; code: string }> = [];
    let alreadyQueued = 0;
    let completed = 0;

    for (const country of RESELLER_SEO_COUNTRIES) {
      const existing = countryRows.get(country.code);
      if (!existing) {
        newRows.push({
          title: `Queued reseller SEO — ${country.name}`,
          content_type: CONTENT_TYPE,
          target_keyword: `reseller-country:${country.code}`,
          body: JSON.stringify({
            countryCode: country.code,
            countryName: country.name,
            attempts: 0,
          }),
          status: "queued",
        });
      } else if (existing.status === "failed") {
        retryRows.push({ id: existing.id, code: country.code });
      } else if (existing.status === "draft") {
        completed += 1;
      } else {
        alreadyQueued += 1;
      }
    }

    if (newRows.length) {
      const { error: insertError } = await supabaseAdmin.from("seo_content_items").insert(newRows);
      if (insertError)
        throw new Error(`Reseller SEO jobs could not be queued: ${insertError.message}`);
    }

    for (let offset = 0; offset < retryRows.length; offset += 5) {
      const batch = retryRows.slice(offset, offset + 5);
      await Promise.all(
        batch.map(async ({ id, code }) => {
          const country = RESELLER_SEO_COUNTRIES.find((entry) => entry.code === code);
          if (!country) throw new Error(`Reseller SEO country ${code} is not registered.`);
          const { error: updateError } = await supabaseAdmin
            .from("seo_content_items")
            .update({
              title: `Queued reseller SEO — ${country.name}`,
              target_keyword: `reseller-country:${country.code}`,
              body: JSON.stringify({
                countryCode: country.code,
                countryName: country.name,
                attempts: 0,
              }),
              status: "queued",
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .eq("status", "failed");
          if (updateError) {
            throw new Error(
              `Failed reseller SEO job ${code} could not be requeued: ${updateError.message}`,
            );
          }
        }),
      );
    }

    return {
      total: RESELLER_SEO_COUNTRIES.length,
      queued: newRows.length + retryRows.length,
      alreadyQueued,
      completed,
    };
  },
);

export const getResellerCountrySeoDraftProgress = createServerFn({ method: "GET" }).handler(
  async () => {
    await requireSeoOperator("Reading reseller country SEO draft progress");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("seo_content_items")
      .select("body, status")
      .eq("content_type", CONTENT_TYPE)
      .limit(500);
    if (error) throw new Error(`Reseller SEO draft progress could not be read: ${error.message}`);

    const byCountry = new Map<string, string>();
    for (const row of rows ?? []) {
      const code = resellerCountryCodeFromDraftBody(row.body);
      if (code && RESELLER_SEO_COUNTRIES.some((country) => country.code === code)) {
        byCountry.set(code, row.status);
      }
    }

    const counts = {
      total: RESELLER_SEO_COUNTRIES.length,
      queued: 0,
      processing: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
    };
    for (const status of byCountry.values()) {
      if (status === "draft") counts.completed += 1;
      else if (status === "processing") counts.processing += 1;
      else if (status === "retry_wait") counts.retrying += 1;
      else if (status === "failed") counts.failed += 1;
      else counts.queued += 1;
    }
    return progressSchema.parse(counts);
  },
);
