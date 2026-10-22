import { z } from "zod";
import { RAIL_COUNTRIES } from "@/lib/marketplace/rail-countries";

export const RESELLER_SEO_MASTER_HASHTAGS = [
  "#software reseller",
  "#software reseller program",
  "#software reseller opportunity",
  "#software reseller business",
  "#become a software reseller",
  "#software reseller partner",
  "#software reselling business",
  "#global software reseller",
  "#online software reseller",
  "#IT reseller program",
  "#low investment business",
  "#low cost reseller business",
  "#affordable reseller program",
  "#online reseller business",
  "#digital reseller business",
  "#work from home business",
  "#work from home opportunities",
  "#student business opportunities",
  "#business for college students",
  "#student entrepreneurship",
  "#business ideas for students",
  "#reseller business for students",
  "#part time business opportunity",
  "#side business opportunities",
  "#side hustle for beginners",
  "#business opportunities for beginners",
  "#online business for beginners",
  "#business for housewives",
  "#work from home for housewives",
  "#women entrepreneur opportunities",
  "#business for job seekers",
  "#extra income opportunities",
  "#freelance business opportunities",
  "#young entrepreneur business",
  "#youth entrepreneurship",
  "#software sales business",
  "#digital product reseller",
  "#technology reseller program",
  "#IT business opportunities",
  "#software distribution partner",
  "#software reseller network",
  "#software reseller worldwide",
  "#international reseller program",
  "#global reseller opportunities",
  "#business partnership opportunities",
  "#online business opportunities",
  "#low cost online business",
  "#start a reseller business",
  "#software reseller India",
  "#software reseller UAE",
  "#Software Vala reseller",
] as const;

if (RESELLER_SEO_MASTER_HASHTAGS.length < 1 || RESELLER_SEO_MASTER_HASHTAGS.length >= 80) {
  throw new Error("Reseller country SEO master hashtag count is invalid.");
}

export const RESELLER_SEO_LOCAL_HASHTAG_COUNT = 80 - RESELLER_SEO_MASTER_HASHTAGS.length;

export const RESELLER_SEO_COUNTRIES = RAIL_COUNTRIES.map((country) => {
  if (!country.code || !country.label.trim()) {
    throw new Error("The Marketplace country registry contains an incomplete country.");
  }
  return { code: country.code, name: country.label };
});

if (
  RESELLER_SEO_COUNTRIES.length !== 100 ||
  new Set(RESELLER_SEO_COUNTRIES.map((country) => country.code)).size !== 100
) {
  throw new Error("Reseller country SEO requires 100 unique countries.");
}

const generatedResellerSeoSchema = z.object({
  primaryLanguage: z.string().trim().min(2).max(60),
  metaTitle: z.string().trim().min(1).max(60),
  metaDescription: z.string().trim().min(1).max(160),
  blogSnippet: z
    .string()
    .trim()
    .min(40)
    .max(3000)
    .refine(
      (value) => value.split(/\r?\n/).filter((line) => line.trim()).length >= 2,
      "The local-language blog snippet must contain at least two lines.",
    ),
  localHashtags: z.array(z.string().trim().min(2).max(80)).length(RESELLER_SEO_LOCAL_HASHTAG_COUNT),
});

export type ResellerCountrySeo = z.infer<typeof generatedResellerSeoSchema>;

export function parseResellerCountrySeo(text: string): ResellerCountrySeo {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The AI provider returned invalid JSON for reseller country SEO.");
  }

  const parsed = generatedResellerSeoSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error("The AI provider returned invalid reseller country SEO fields.");
  }

  const hashtags = parsed.data.localHashtags.map((tag) => {
    const normalized = tag.startsWith("#") ? tag : `#${tag}`;
    if (!/^#[\p{L}\p{N}_]+$/u.test(normalized)) {
      throw new Error("Local reseller hashtags must be single, valid hashtag tokens.");
    }
    return normalized;
  });
  const uniqueHashtags = new Set(hashtags.map((tag) => tag.toLocaleLowerCase("en-US")));
  if (uniqueHashtags.size !== RESELLER_SEO_LOCAL_HASHTAG_COUNT) {
    throw new Error(
      `The AI response must contain exactly ${RESELLER_SEO_LOCAL_HASHTAG_COUNT} unique local hashtags.`,
    );
  }
  const masterKeys = new Set(
    RESELLER_SEO_MASTER_HASHTAGS.map((tag) =>
      tag.slice(1).replace(/\s+/g, "_").toLocaleLowerCase("en-US"),
    ),
  );
  if (hashtags.some((tag) => masterKeys.has(tag.slice(1).toLocaleLowerCase("en-US")))) {
    throw new Error("Local reseller hashtags must not duplicate the master hashtag set.");
  }

  return { ...parsed.data, localHashtags: hashtags };
}

export function resellerCountrySeoHashtags(localHashtags: string[], countryCode: string): string[] {
  if (localHashtags.length !== RESELLER_SEO_LOCAL_HASHTAG_COUNT) {
    throw new Error(
      `A reseller country draft must include exactly ${RESELLER_SEO_LOCAL_HASHTAG_COUNT} local hashtags.`,
    );
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("A reseller country draft must use a valid ISO alpha-2 country code.");
  }
  const countrySuffix = `_${countryCode.toLocaleLowerCase("en-US")}`;
  const countryHashtags = localHashtags.map((tag) => `${tag}${countrySuffix}`);
  const hashtags = [...RESELLER_SEO_MASTER_HASHTAGS, ...countryHashtags];
  if (hashtags.length !== 80) {
    throw new Error("A reseller country draft must contain exactly 80 hashtags.");
  }
  return hashtags;
}

export function formatResellerCountrySeoDraft(
  country: { code: string; name: string },
  content: ResellerCountrySeo,
): string {
  const hashtags = resellerCountrySeoHashtags(content.localHashtags, country.code);
  return [
    `Country: ${country.name} (${country.code})`,
    `Primary language: ${content.primaryLanguage}`,
    "",
    `Meta title: ${content.metaTitle}`,
    `Meta description: ${content.metaDescription}`,
    "",
    "Blog snippet:",
    content.blogSnippet,
    "",
    `Hashtags (${RESELLER_SEO_MASTER_HASHTAGS.length} master + ${RESELLER_SEO_LOCAL_HASHTAG_COUNT} local):`,
    ...hashtags,
  ].join("\n");
}

export function resellerCountryCodeFromDraftBody(body: string | null): string | null {
  if (!body) return null;
  try {
    const value: unknown = JSON.parse(body);
    if (
      typeof value === "object" &&
      value !== null &&
      "countryCode" in value &&
      typeof value.countryCode === "string" &&
      /^[A-Z]{2}$/.test(value.countryCode)
    ) {
      return value.countryCode;
    }
  } catch {
    // Completed drafts use readable text rather than the queue's JSON payload.
  }
  return body.match(/^Country: .* \(([A-Z]{2})\)$/m)?.[1] ?? null;
}
