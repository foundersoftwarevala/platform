import { z } from "zod";

import { withVpsPublicDatabase } from "@/lib/marketplace-manager/vps-rpc.server";

export const AYRA_COMPANY_PROFILE_FIELDS = [
  "company_name",
  "contact_name",
  "email",
  "phone",
  "address",
  "address_line_2",
  "city",
  "region",
  "postal_code",
  "country",
  "website",
] as const;
export type AyraCompanyProfileField = (typeof AYRA_COMPANY_PROFILE_FIELDS)[number];
export type AyraCompanyProfile = Record<AyraCompanyProfileField, string>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ProfileRowSchema = z.object({
  company_name: z.string(),
  contact_name: z.string(),
  email: z.string(),
  phone: z.string(),
  address: z.string(),
  address_line_2: z.string(),
  city: z.string(),
  region: z.string(),
  postal_code: z.string(),
  country: z.string(),
  website: z.string(),
});
const MappingRowSchema = z.object({
  form_field_name: z.string(),
  profile_field_name: z.enum(AYRA_COMPANY_PROFILE_FIELDS),
});
const FormFieldSchema = z
  .object({
    index: z.number().int().min(0).max(99),
    name: z.string().max(200).optional(),
    id: z.string().max(200).optional(),
    label: z.string().max(200).optional(),
    placeholder: z.string().max(200).optional(),
    autocomplete: z.string().max(100).optional(),
  })
  .strict();
const FormFieldsSchema = z.array(FormFieldSchema).max(100);

export type AyraFormFieldDescriptor = z.infer<typeof FormFieldSchema>;
export type AyraFormFill = {
  index: number;
  profileFieldName: AyraCompanyProfileField;
  value: string;
};

export const EMPTY_AYRA_COMPANY_PROFILE: AyraCompanyProfile = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  address_line_2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
  website: "",
};

function normalizeFieldName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function loadAyraCompanyProfile(): Promise<{
  configured: boolean;
  profile: AyraCompanyProfile;
}> {
  const [row] = await withVpsPublicDatabase(
    (tx) => tx<Record<AyraCompanyProfileField, string>[]>`
      select company_name, contact_name, email, phone, address, address_line_2,
             city, region, postal_code, country, website
        from public.ayra_company_profile
       where profile_key = 'softwarevala'
       limit 1
    `,
  );
  if (!row) return { configured: false, profile: { ...EMPTY_AYRA_COMPANY_PROFILE } };
  const profile = ProfileRowSchema.parse(row);
  return { configured: Boolean(profile.company_name.trim()), profile };
}

export async function saveAyraCompanyProfile(
  profile: AyraCompanyProfile,
  updatedBy: string,
): Promise<AyraCompanyProfile> {
  if (!UUID.test(updatedBy)) throw new Error("A valid executive user is required.");
  const parsed = ProfileRowSchema.parse(profile);
  if (!parsed.company_name.trim()) throw new Error("Company name is required before saving.");
  const [row] = await withVpsPublicDatabase(
    (tx) => tx<Record<AyraCompanyProfileField, string>[]>`
      insert into public.ayra_company_profile
        (profile_key, company_name, contact_name, email, phone, address, address_line_2,
         city, region, postal_code, country, website, updated_by, updated_at)
      values
        ('softwarevala', ${parsed.company_name.trim()}, ${parsed.contact_name.trim()},
         ${parsed.email.trim()}, ${parsed.phone.trim()}, ${parsed.address.trim()},
         ${parsed.address_line_2.trim()}, ${parsed.city.trim()}, ${parsed.region.trim()},
         ${parsed.postal_code.trim()}, ${parsed.country.trim()}, ${parsed.website.trim()},
         ${updatedBy}::uuid, now())
      on conflict (profile_key) do update set
        company_name = excluded.company_name,
        contact_name = excluded.contact_name,
        email = excluded.email,
        phone = excluded.phone,
        address = excluded.address,
        address_line_2 = excluded.address_line_2,
        city = excluded.city,
        region = excluded.region,
        postal_code = excluded.postal_code,
        country = excluded.country,
        website = excluded.website,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning company_name, contact_name, email, phone, address, address_line_2,
                city, region, postal_code, country, website
    `,
  );
  if (!row) throw new Error("VPS Postgres did not return the saved company profile.");
  return ProfileRowSchema.parse(row);
}

export async function autoFillForm(
  userId: string,
  formData: AyraFormFieldDescriptor[],
): Promise<AyraFormFill[]> {
  if (!UUID.test(userId)) throw new Error("A valid executive user is required.");
  const fields = FormFieldsSchema.parse(formData);
  const { configured, profile } = await loadAyraCompanyProfile();
  if (!configured) {
    throw new Error("Save the Software Vala company profile in AYRA Command Center before autofilling.");
  }
  const mappingRows = await withVpsPublicDatabase(
    (tx) => tx<z.infer<typeof MappingRowSchema>[]>`
      select form_field_name, profile_field_name
        from public.ayra_form_mappings
       where is_active = true
    `,
  );
  const mappings = mappingRows.map((row) => MappingRowSchema.parse(row));
  const mappingByField = new Map(
    mappings.map((mapping) => [
      normalizeFieldName(mapping.form_field_name),
      mapping.profile_field_name,
    ]),
  );
  const matches: AyraFormFill[] = [];
  for (const field of fields) {
    const candidates = [field.label, field.name, field.id, field.placeholder, field.autocomplete]
      .filter((candidate): candidate is string => Boolean(candidate?.trim()))
      .map(normalizeFieldName);
    const profileFieldName = candidates
      .map((candidate) => mappingByField.get(candidate))
      .find((mapping): mapping is AyraCompanyProfileField => Boolean(mapping));
    if (!profileFieldName) continue;
    const value = profile[profileFieldName].trim();
    if (value) matches.push({ index: field.index, profileFieldName, value });
  }
  return matches;
}
