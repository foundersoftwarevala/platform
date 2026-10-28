import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  AYRA_COMPANY_PROFILE_FIELDS,
  autoFillForm,
  loadAyraCompanyProfile as loadProfile,
  saveAyraCompanyProfile as saveProfile,
} from "./ayra-autofill.server";
import { requireVpsExecutive } from "./vps-auth.server";
import { createAyraAutofillExtensionToken } from "./ayra-extension.server";

const ProfileSchema = z
  .object({
    company_name: z.string().trim().min(1).max(200),
    contact_name: z.string().trim().max(200),
    email: z.string().trim().max(320),
    phone: z.string().trim().max(80),
    address: z.string().trim().max(300),
    address_line_2: z.string().trim().max(200),
    city: z.string().trim().max(120),
    region: z.string().trim().max(120),
    postal_code: z.string().trim().max(40),
    country: z.string().trim().max(120),
    website: z.string().trim().max(500),
  })
  .strict();
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

export const loadAyraCompanyProfile = createServerFn({ method: "GET" }).handler(async () => {
  await requireVpsExecutive();
  return loadProfile();
});

export const saveAyraCompanyProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => ProfileSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await requireVpsExecutive();
    return saveProfile(data, userId);
  });

export const autoFillAyraCompanyForm = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ fields: z.array(FormFieldSchema).max(100) }).strict().parse(input))
  .handler(async ({ data }) => {
    const userId = await requireVpsExecutive();
    return autoFillForm(userId, data.fields);
  });

export const issueAyraAutofillExtensionToken = createServerFn({ method: "POST" }).handler(async () => {
  const userId = await requireVpsExecutive();
  return createAyraAutofillExtensionToken(userId);
});
