import { documentFields } from "./documents";
import { findOwnApplication, isApplicationKind, type ApplicationKind } from "./registry.server";
import { rpcAs } from "./gateway.server";
import { checkApplication } from "./validate";

/**
 * One application, from the form to its table.
 *
 * Every role applies the same way: the form's own fields are checked and the
 * role's own database function is called
 * with the applicant's token - so the function knows who is applying, refuses
 * a second open application and keeps what was submitted. Nothing here
 * decides anything the function decides; it only makes sure the function is
 * given exactly what the form collected and nothing it did not.
 */

export type Submitted = {
  kind: ApplicationKind;
  id: string | null;
  number: string;
  status: string;
  duplicate: boolean;
  /**
   * For vendors and authors: this account already holds the other kind of
   * seller application. One account holds one seller record, so the existing
   * application is what is returned - and it is named as what it is.
   */
  conflict: boolean;
  existingKind: string | null;
  /** The document fields this application may attach files to. */
  documents: { name: string; label: string }[];
};

export type SubmitFailure = { error: string; status: number; fields?: string[] };

type RpcResult = {
  application_number?: string;
  status?: string;
  duplicate?: boolean;
  id?: string;
  conflict?: boolean;
  existing_kind?: string | null;
};

const numberOr = (value: string | undefined): number | null => {
  if (!value) return null;
  const n = Number(value.replace(/,/g, "").replace(/%/g, ""));
  return Number.isFinite(n) ? n : null;
};

export async function submitApplication(
  role: string,
  raw: Record<string, unknown>,
  agreementAccepted: boolean,
  token: string,
  userId: string,
): Promise<Submitted | SubmitFailure> {
  if (role === "employee") {
    return { error: "Online applications for this role are not open.", status: 403 };
  }
  if (!isApplicationKind(role)) return { error: "That role does not exist.", status: 404 };
  if (!agreementAccepted) return { error: "Please accept the agreement to continue.", status: 400 };

  const checked = checkApplication(role, raw);
  if (!checked.ok) return { error: checked.error, status: 400, fields: checked.fields };
  const values = checked.values;
  const application = { ...values, agreementAccepted: true };

  let outcome;
  switch (role) {
    case "reseller":
      outcome = await rpcAs<RpcResult>(token, "submit_reseller_application", {
        p_application: application,
      });
      break;
    case "vendor":
    case "author":
      outcome = await rpcAs<RpcResult>(token, "submit_seller_application", {
        p_kind: role,
        p_application: application,
      });
      break;
    case "franchise":
      outcome = await rpcAs<RpcResult>(token, "submit_franchise_application", {
        p_application: application,
      });
      break;
    case "affiliate":
      outcome = await rpcAs<RpcResult>(token, "submit_affiliate_application", {
        p_display_name: values.fullName ?? "",
        p_application: application,
      });
      break;
    case "influencer":
      outcome = await rpcAs<RpcResult>(token, "submit_influencer_application", {
        p_full_name: values.fullName,
        p_email: values.email,
        p_phone: values.phone ?? null,
        p_country: values.country ?? null,
        p_region: [values.city, values.state].filter(Boolean).join(", ") || null,
        p_social_profiles: {
          instagram: values.instagram ?? null,
          youtube: values.youtube ?? null,
          linkedin: values.linkedin ?? null,
          x: values.xTwitter ?? null,
          rate_card: values.rateCard ?? null,
          past_brands: values.pastBrands ?? null,
        },
        p_followers: numberOr(values.followers) ?? 0,
        p_niche: values.niche ?? "",
        p_content_types: null,
        p_engagement_rate: numberOr(values.engagementRate),
        // The influencer form has no bank section; payment details are taken
        // at payout time, from the influencer's own dashboard.
        p_payment_details: {},
        p_tax_details: { id_type: values.idType ?? null },
        p_agreement_accepted: true,
        p_consent_accepted: true,
        p_terms_accepted: true,
        // The application as submitted - every field, as typed - kept beside
        // the columns above, as every other role's is.
        p_application: application,
      });
      break;
  }

  if (!outcome || !outcome.ok) {
    return {
      error: outcome?.message ?? "The application could not be submitted.",
      status: outcome?.status ?? 400,
    };
  }

  const result = outcome.data ?? {};
  const conflict = result.conflict === true;
  const existingKind = result.existing_kind ?? null;
  const ownKind = (
    conflict && isApplicationKind(existingKind) ? existingKind : role
  ) as ApplicationKind;
  const found = result.id ? null : await findOwnApplication(ownKind, userId);

  return {
    kind: role,
    id: result.id ?? found?.id ?? null,
    number: result.application_number ?? found?.number ?? "",
    status: result.status ?? found?.status ?? "pending",
    duplicate: result.duplicate === true,
    conflict,
    existingKind,
    documents: conflict ? [] : documentFields(role),
  };
}
