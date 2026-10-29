import { getRequestHeader } from "@tanstack/react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bearerToken, userFromBearerToken } from "@/lib/auth/bearer-user.server";
import { requestVpsAiJson } from "@/lib/ai-manager-vps.server";
import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

export const RESELLER_APPLICATION_URL = "https://softwarevala.net/apply/reseller";
export const RESELLER_SEO_COUNTRIES = [
  "India",
  "Philippines",
  "Nigeria",
  "Kenya",
  "South Africa",
  "Bangladesh",
  "Pakistan",
  "Indonesia",
  "Brazil",
  "United Arab Emirates",
] as const;

const generatedCountrySchema = z.object({
  country: z.string().trim().min(1).max(100),
  keyword: z.string().trim().min(1).max(120),
  metaTitle: z.string().trim().min(1).max(100),
  metaDescription: z.string().trim().min(1).max(300),
  hashtags: z.array(z.string().min(2).max(50)).length(10),
});

const generatedResponseSchema = z.object({
  countries: z.array(generatedCountrySchema).length(RESELLER_SEO_COUNTRIES.length),
});

export type ResellerSeoAsset = {
  id: string;
  role_type: string;
  country: string;
  keyword: string;
  hashtag: string;
  meta_title: string;
  meta_description: string;
  backlink_url: string;
  status: string;
  created_at: string;
};

export type GeneratedCountrySeo = z.infer<typeof generatedCountrySchema>;

function applicationUrlSuffix(): string {
  return ` Apply: ${RESELLER_APPLICATION_URL}`;
}

function boundedDescription(description: string): string {
  const suffix = applicationUrlSuffix();
  const bodyLimit = 160 - suffix.length;
  const body = description.replace(/\s+/g, " ").trim().slice(0, bodyLimit).trimEnd();
  return `${body}${suffix}`;
}

function countryHashtags(country: string, hashtags: string[]): string {
  const brandTag = "#SoftwareVala";
  const clean = [
    ...new Set(
      hashtags
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter((tag) => /^[A-Za-z0-9]{2,40}$/.test(tag))
        .filter((tag) => tag.toLowerCase() !== "softwarevala"),
    ),
  ]
    .slice(0, 9)
    .map((tag) => `#${tag}`);

  const slug = country.replace(/[^A-Za-z0-9]/g, "");
  const fallbacks = [
    `#Reseller${slug}`,
    `#SoftwareReseller${slug}`,
    `#BusinessPartner${slug}`,
    "#SoftwareReseller",
    "#BusinessOpportunity",
    "#B2BSoftware",
    "#ChannelPartner",
    "#ResellerProgram",
    "#BusinessSoftware",
  ];
  for (const tag of fallbacks) {
    if (clean.length >= 9) break;
    if (!clean.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      clean.push(tag);
    }
  }
  return [...clean.slice(0, 9), brandTag].join(" ");
}

export function prepareResellerSeoAssets(
  generated: GeneratedCountrySeo[],
): Omit<ResellerSeoAsset, "id" | "created_at">[] {
  const byCountry = new Map(generated.map((item) => [item.country.trim().toLowerCase(), item]));

  return RESELLER_SEO_COUNTRIES.map((country) => {
    const item = byCountry.get(country.toLowerCase());
    if (!item) throw new Error(`The AI response omitted ${country}.`);
    return {
      role_type: "reseller",
      country,
      keyword: item.keyword.trim(),
      hashtag: countryHashtags(country, item.hashtags),
      meta_title: item.metaTitle.trim().slice(0, 60),
      meta_description: boundedDescription(item.metaDescription),
      backlink_url: RESELLER_APPLICATION_URL,
      status: "draft",
    };
  });
}

async function requireSeoOperator(): Promise<string> {
  const token = bearerToken(getRequestHeader("authorization") ?? getRequestHeader("Authorization"));
  if (!token) throw new Error("Sign in with an SEO or marketing account to continue.");
  const user = await userFromBearerToken(token);
  if (!user) throw new Error("Sign in with an SEO or marketing account to continue.");

  const allowed = await withVpsPublicDatabase(async (tx) => {
    const [row] = await tx<{ allowed: boolean }[]>`
      select exists (
        select 1
          from public.user_roles
         where user_id = ${user.id}::uuid
           and role::text in ('admin', 'boss', 'founder', 'super_admin',
                              'boss_owner', 'marketing', 'seo')
      ) as allowed
    `;
    return row?.allowed === true;
  });
  if (!allowed) throw new Error("SEO or marketing operator permission is required.");
  return user.id;
}

const vpsRunner = <T>(run: Parameters<typeof withVpsPublicDatabase<T>>[0]) =>
  withVpsPublicDatabase(run);

export const listBulkResellerSeoAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<ResellerSeoAsset[]> => {
    await requireSeoOperator();
    return withVpsPublicDatabase(
      (tx) =>
        tx<ResellerSeoAsset[]>`
        select id::text, role_type, country, keyword, hashtag, meta_title,
               meta_description, backlink_url, status, created_at::text
          from public.seo_bulk_assets
         where role_type = 'reseller'
         order by created_at desc, country
         limit 100
      `,
    );
  },
);

export const generateBulkResellerSeoAssets = createServerFn({ method: "POST" }).handler(
  async (): Promise<ResellerSeoAsset[]> => {
    await requireSeoOperator();
    const prompt = `Generate one country-specific reseller SEO record for each of these exact countries, in this exact order: ${RESELLER_SEO_COUNTRIES.join(", ")}.
For every country provide:
- country: exact country name from the list
- keyword: one natural phrase about becoming a software reseller in that country
- metaTitle: accurate title under 60 characters; do not make job, income, ranking, or market-leadership claims
- metaDescription: concise factual description of the reseller application, without unsupported earnings or employment claims
- hashtags: exactly 10 distinct hashtag strings, including #SoftwareVala
Return JSON only as {"countries":[{"country":"...","keyword":"...","metaTitle":"...","metaDescription":"...","hashtags":["#..."]}]}. Do not invent external websites or backlink opportunities.`;
    const { value } = await requestVpsAiJson({
      withDatabase: vpsRunner,
      serviceName: "Ollama Local",
      modelId: "qwen2.5:3b",
      product: "generate_bulk_seo_reseller",
      source: "seo-manager:bulk-reseller-seo",
      system:
        "You create truthful, review-only SEO copy for the Software Vala reseller program. Return only valid JSON matching the requested structure.",
      prompt,
      schema: generatedResponseSchema,
      maxTokens: 3000,
    });

    const prepared = prepareResellerSeoAssets(value.countries);
    return withVpsPublicDatabase(async (tx) => {
      const inserted: ResellerSeoAsset[] = [];
      for (const asset of prepared) {
        const [row] = await tx<ResellerSeoAsset[]>`
          insert into public.seo_bulk_assets
            (role_type, country, keyword, hashtag, meta_title,
             meta_description, backlink_url, status)
          values
            (${asset.role_type}, ${asset.country}, ${asset.keyword}, ${asset.hashtag},
             ${asset.meta_title}, ${asset.meta_description}, ${asset.backlink_url}, 'draft')
          returning id::text, role_type, country, keyword, hashtag, meta_title,
                    meta_description, backlink_url, status, created_at::text
        `;
        if (!row) throw new Error(`Could not save reseller SEO assets for ${asset.country}.`);
        inserted.push(row);
      }
      return inserted;
    });
  },
);
