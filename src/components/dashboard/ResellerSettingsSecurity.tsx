import {
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  getResellerAccountSettings,
  listResellerKycDocuments,
  registerResellerKycDocument,
  saveResellerAccountSettings,
} from "@/lib/reseller-dashboard.functions";

type Props = { featureKey: string };

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block space-y-1.5 text-xs">
      <span className="font-medium">{label}</span>
      <input
        className={inputClass}
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        readOnly={!onChange}
      />
    </label>
  );
}

function ResellerSettingsSecurity({ featureKey }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["reseller-account-settings"],
    queryFn: () => getResellerAccountSettings(),
    enabled: ["profile", "company", "payment", "bank", "upi", "kyc"].includes(featureKey),
  });
  const documentsQuery = useQuery({
    queryKey: ["reseller-kyc-documents"],
    queryFn: () => listResellerKycDocuments(),
    enabled: featureKey === "kyc",
  });
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [factors, setFactors] = useState<{ id: string; friendly_name: string | null }[]>([]);
  const [factorError, setFactorError] = useState<string | null>(null);
  const [factorLoading, setFactorLoading] = useState(false);
  const [enrollment, setEnrollment] = useState<{ id: string; qrCode: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setValues({
      ...settingsQuery.data.profile,
      ...settingsQuery.data.settings,
    });
  }, [settingsQuery.data]);

  useEffect(() => {
    if (featureKey !== "2fa") return;
    let cancelled = false;
    setFactorLoading(true);
    void supabase.auth.mfa
      .listFactors()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setFactorError(error.message);
          setFactorLoading(false);
          return;
        }
        setFactors(
          (data.totp ?? []).map((factor) => ({
            id: factor.id,
            friendly_name: factor.friendly_name ?? null,
          })),
        );
        setFactorError(null);
        setFactorLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFactorError(
          error instanceof Error ? error.message : t("reseller.auth_factors_load_failed"),
        );
        setFactorLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [featureKey, t]);

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(fields: Record<string, string>) {
    setSaving(true);
    try {
      await saveResellerAccountSettings({ data: fields });
      await queryClient.invalidateQueries({ queryKey: ["reseller-account-settings"] });
      toast.success(t("reseller.settings_saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("reseller.settings_save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function uploadKyc(file?: File) {
    if (!file) return;
    const permitted = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!permitted.includes(file.type)) {
      toast.error(t("reseller.kyc_file_type"));
      return;
    }
    if (file.size < 1 || file.size > 10 * 1024 * 1024) {
      toast.error(t("reseller.kyc_file_size"));
      return;
    }
    setUploading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error(t("reseller.sign_in_before_kyc"));
      const resellerId = settingsQuery.data?.profile.resellerId;
      if (!resellerId) throw new Error(t("reseller.profile_unavailable"));
      const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180) || "document";
      const storagePath = `${userData.user.id}/${resellerId}/${crypto.randomUUID()}-${safeName}`;
      const uploaded = await supabase.storage
        .from("reseller-kyc-documents")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploaded.error) throw uploaded.error;

      try {
        await registerResellerKycDocument({
          data: {
            storagePath,
            fileName: file.name,
            mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
            fileSize: file.size,
          },
        });
      } catch (error) {
        const cleanup = await supabase.storage.from("reseller-kyc-documents").remove([storagePath]);
        if (cleanup.error) {
          throw new Error(
            `${error instanceof Error ? error.message : t("reseller.kyc_record_save_failed")} ` +
              t("reseller.kyc_file_remove_failed", { error: cleanup.error.message }),
          );
        }
        throw error;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reseller-kyc-documents"] }),
        queryClient.invalidateQueries({ queryKey: ["reseller-account-settings"] }),
      ]);
      toast.success(t("reseller.kyc_uploaded"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("reseller.kyc_upload_failed"),
      );
    } finally {
      setUploading(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) {
      toast.error(t("reseller.password_minimum"));
      return;
    }
    if (password !== passwordConfirm) {
      toast.error(t("reseller.password_mismatch"));
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setPasswordConfirm("");
      toast.success(t("reseller.password_changed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("reseller.password_change_failed"));
    } finally {
      setChangingPassword(false);
    }
  }

  async function startMfaEnrollment() {
    setMfaBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: t("reseller.authenticator_name"),
      });
      if (error) throw error;
      setEnrollment({ id: data.id, qrCode: data.totp.qr_code });
      setVerificationCode("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("reseller.mfa_setup_failed"),
      );
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyMfaEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setMfaBusy(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: enrollment.id });
      if (challenge.error) throw challenge.error;
      const verified = await supabase.auth.mfa.verify({
        factorId: enrollment.id,
        challengeId: challenge.data.id,
        code: verificationCode.trim(),
      });
      if (verified.error) throw verified.error;
      setEnrollment(null);
      setVerificationCode("");
      setFactors((current) => [
        ...current,
        { id: enrollment.id, friendly_name: t("reseller.authenticator_name") },
      ]);
      toast.success(t("reseller.mfa_enabled"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("reseller.mfa_code_rejected"),
      );
    } finally {
      setMfaBusy(false);
    }
  }

  async function removeMfaFactor(factorId: string) {
    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      setFactors((current) => current.filter((factor) => factor.id !== factorId));
      toast.success(t("reseller.mfa_removed"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("reseller.authenticator_remove_failed"),
      );
    } finally {
      setMfaBusy(false);
    }
  }

  if (
    ["profile", "company", "payment", "bank", "upi", "kyc"].includes(featureKey) &&
    settingsQuery.isPending
  ) {
    return <div className="p-6 text-sm text-muted-foreground">{t("reseller.loading_account")}</div>;
  }
  if (
    settingsQuery.isError &&
    ["profile", "company", "payment", "bank", "upi", "kyc"].includes(featureKey)
  ) {
    return (
      <div role="alert" className="p-6 text-sm text-destructive">
        {settingsQuery.error.message}
      </div>
    );
  }

  if (featureKey === "profile") {
    return (
      <form
        className="grid gap-4 p-6 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            name: values.name ?? "",
            phone: values.phone ?? "",
            timezone: values.timezone ?? "UTC",
          });
        }}
      >
        <Field
          label={t("reseller.full_name")}
          value={values.name ?? ""}
          onChange={(value) => setValue("name", value)}
          required
        />
        <Field label={t("reseller.email")} value={values.email ?? ""} />
        <Field
          label={t("reseller.phone")}
          value={values.phone ?? ""}
          onChange={(value) => setValue("phone", value)}
        />
        <Field
          label={t("reseller.timezone")}
          value={values.timezone ?? "UTC"}
          onChange={(value) => setValue("timezone", value)}
        />
        <div className="md:col-span-2">
          <SaveButton busy={saving} savingLabel={t("reseller.saving")}>
            {t("reseller.save_profile")}
          </SaveButton>
        </div>
      </form>
    );
  }

  if (featureKey === "company") {
    return (
      <form
        className="grid gap-4 p-6 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            companyName: values.companyName ?? "",
            legalName: values.legalName ?? "",
            gstNumber: values.gstNumber ?? "",
            panNumber: values.panNumber ?? "",
            region: values.region ?? "",
            companyAddress: values.companyAddress ?? "",
          });
        }}
      >
        <Field
          label={t("reseller.company_name")}
          value={values.companyName ?? ""}
          onChange={(value) => setValue("companyName", value)}
        />
        <Field
          label={t("reseller.legal_name")}
          value={values.legalName ?? ""}
          onChange={(value) => setValue("legalName", value)}
        />
        <Field
          label={t("reseller.gstin")}
          value={values.gstNumber ?? ""}
          onChange={(value) => setValue("gstNumber", value)}
        />
        <Field
          label={t("reseller.pan")}
          value={values.panNumber ?? ""}
          onChange={(value) => setValue("panNumber", value)}
        />
        <Field
          label={t("reseller.region")}
          value={values.region ?? ""}
          onChange={(value) => setValue("region", value)}
        />
        <label className="block space-y-1.5 text-xs md:col-span-2">
          <span className="font-medium">{t("reseller.company_address")}</span>
          <textarea
            className={inputClass}
            value={values.companyAddress ?? ""}
            onChange={(event) => setValue("companyAddress", event.currentTarget.value)}
            rows={3}
          />
        </label>
        <div className="md:col-span-2">
          <SaveButton busy={saving} savingLabel={t("reseller.saving")}>
            {t("reseller.save_company_details")}
          </SaveButton>
        </div>
      </form>
    );
  }

  if (featureKey === "payment" || featureKey === "bank" || featureKey === "upi") {
    return (
      <form
        className="grid gap-4 p-6 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const fields: Record<string, string> = {};
          if (featureKey === "payment") fields.payoutMethod = values.payoutMethod ?? "bank";
          if (featureKey === "bank") {
            fields.bankAccountHolder = values.bankAccountHolder ?? "";
            fields.bankName = values.bankName ?? "";
            fields.bankAccountNumber = values.bankAccountNumber ?? "";
            fields.bankIfsc = values.bankIfsc ?? "";
          }
          if (featureKey === "upi") fields.upiVpa = values.upiVpa ?? "";
          void save(fields);
        }}
      >
        {featureKey === "payment" && (
          <>
            <label className="block space-y-1.5 text-xs md:col-span-2">
              <span className="font-medium">{t("reseller.preferred_payout_method")}</span>
              <select
                className={inputClass}
                value={values.payoutMethod ?? "bank"}
                onChange={(event) => setValue("payoutMethod", event.currentTarget.value)}
              >
                <option value="bank">{t("reseller.bank_account")}</option>
                <option value="upi">{t("reseller.upi")}</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground md:col-span-2">
              {t("reseller.payout_instructions_notice")}
            </p>
          </>
        )}
        {featureKey === "bank" && (
          <>
            <Field
              label={t("reseller.account_holder_name")}
              value={values.bankAccountHolder ?? ""}
              onChange={(value) => setValue("bankAccountHolder", value)}
            />
            <Field
              label={t("reseller.bank_name")}
              value={values.bankName ?? ""}
              onChange={(value) => setValue("bankName", value)}
            />
            <Field
              label={t("reseller.account_number")}
              value={values.bankAccountNumber ?? ""}
              onChange={(value) => setValue("bankAccountNumber", value)}
            />
            <Field
              label={t("reseller.ifsc_code")}
              value={values.bankIfsc ?? ""}
              onChange={(value) => setValue("bankIfsc", value)}
            />
          </>
        )}
        {featureKey === "upi" && (
          <Field
            label={t("reseller.upi_id")}
            value={values.upiVpa ?? ""}
            onChange={(value) => setValue("upiVpa", value)}
            placeholder={t("reseller.upi_placeholder")}
          />
        )}
        <div className="md:col-span-2">
          <SaveButton busy={saving} savingLabel={t("reseller.saving")}>
            {t("reseller.save")}{" "}
            {featureKey === "payment"
              ? t("reseller.payment_preference")
              : featureKey === "bank"
                ? t("reseller.bank_details")
                : t("reseller.upi_details")}
          </SaveButton>
        </div>
      </form>
    );
  }

  if (featureKey === "password") {
    return (
      <form className="grid gap-4 p-6 md:max-w-xl" onSubmit={(event) => void changePassword(event)}>
        <p className="text-xs text-muted-foreground">
          {t("reseller.password_update_notice")}
        </p>
        <Field
          label={t("reseller.new_password")}
          value={password}
          onChange={setPassword}
          type="password"
          required
          autoComplete="new-password"
        />
        <Field
          label={t("reseller.confirm_new_password")}
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          type="password"
          required
          autoComplete="new-password"
        />
        <SaveButton busy={changingPassword} savingLabel={t("reseller.saving")}>
          {t("reseller.change_password")}
        </SaveButton>
      </form>
    );
  }

  if (featureKey === "2fa") {
    return (
      <div className="space-y-4 p-6">
        <p className="text-xs text-muted-foreground">
          {t("reseller.authenticator_setup_notice")}
        </p>
        {factorLoading ? (
          <p className="text-sm text-muted-foreground">{t("reseller.checking_auth_factors")}</p>
        ) : null}
        {factorError ? (
          <p role="alert" className="text-sm text-destructive">
            {factorError}
          </p>
        ) : null}
        {!factorLoading &&
          factors.map((factor) => (
            <div
              key={factor.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
            >
              <span className="text-sm">
                {factor.friendly_name || t("reseller.authenticator_app")}{" "}
                <span className="text-muted-foreground">{t("reseller.enabled")}</span>
              </span>
              <button
                type="button"
                disabled={mfaBusy}
                onClick={() => void removeMfaFactor(factor.id)}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {t("reseller.remove")}
              </button>
            </div>
          ))}
        {enrollment ? (
          <form
            className="grid gap-3 sm:grid-cols-[auto_1fr]"
            onSubmit={(event) => void verifyMfaEnrollment(event)}
          >
            <img
              src={enrollment.qrCode}
              alt={t("reseller.authenticator_qr_alt")}
              className="h-40 w-40 rounded-lg border border-border bg-white p-2"
            />
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {t("reseller.authenticator_verify_instructions")}
              </p>
              <Field
                label={t("reseller.authenticator_code")}
                value={verificationCode}
                onChange={setVerificationCode}
                inputMode="numeric"
                placeholder="123456"
                required
              />
              <SaveButton busy={mfaBusy} savingLabel={t("reseller.saving")}>
                {t("reseller.verify_enable_2fa")}
              </SaveButton>
            </div>
          </form>
        ) : factors.length === 0 && !factorLoading ? (
          <button
            type="button"
            disabled={mfaBusy}
            onClick={() => void startMfaEnrollment()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-60"
          >
            {t("reseller.setup_authenticator")}
          </button>
        ) : null}
      </div>
    );
  }

  if (featureKey === "kyc") {
    return (
      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{t("reseller.verification_status")}</span>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs capitalize">
            {settingsQuery.data?.profile.kycStatus ?? t("reseller.unverified")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("reseller.kyc_upload_instructions")}
        </p>
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground has-[:disabled]:cursor-wait">
          {uploading ? t("reseller.uploading") : t("reseller.upload_kyc")}
          <input
            type="file"
            className="sr-only"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              void uploadKyc(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        {documentsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">{t("reseller.loading_documents")}</p>
        ) : null}
        {documentsQuery.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {documentsQuery.error.message}
          </p>
        ) : null}
        {(documentsQuery.data ?? []).length > 0 && (
          <ul className="space-y-2">
            {documentsQuery.data?.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <span className="min-w-0 truncate text-sm">{document.fileName}</span>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-brand underline"
                >
                  {t("reseller.open_private_document")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 text-sm text-muted-foreground">
      {t("reseller.security_not_configured")}
    </div>
  );
}

function SaveButton({
  busy,
  savingLabel,
  children,
}: {
  busy: boolean;
  savingLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? savingLabel : children}
    </button>
  );
}

export { ResellerSettingsSecurity };
