import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  REQUEST_PDF_LIMIT,
  REQUEST_TEXT_LIMIT,
  softwareRequestReceiptSchema,
  type SoftwareRequestReceipt,
} from "@/lib/rd-module/public-request";

export function RequestSoftwareForm() {
  const { t } = useTranslation();
  const { user, session, isLoading } = useAuth();
  const verified = Boolean(user?.email && user.email_confirmed_at);
  const [email, setEmail] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [website, setWebsite] = useState("");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SoftwareRequestReceipt | null>(null);

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { error: problem } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/request-software` },
      });
      if (problem) throw problem;
      setLinkSent(true);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : t("rd.verification_link_failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session?.access_token || !verified) {
      setError(t("rd.verify_email_before_submit"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!text.trim() && !pdf) throw new Error(t("rd.describe_or_attach"));
      if (pdf && (pdf.size === 0 || pdf.size > REQUEST_PDF_LIMIT))
        throw new Error(t("rd.choose_valid_pdf"));
      const id = submissionId ?? crypto.randomUUID();
      setSubmissionId(id);
      const body = new FormData();
      body.set("submissionId", id);
      body.set("text", text);
      body.set("website", website);
      if (pdf) body.set("pdf", pdf);
      const response = await fetch("/api/rd-request", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body,
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message =
          result &&
          typeof result === "object" &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : t("rd.submission_failed_retry");
        throw new Error(message);
      }
      setReceipt(softwareRequestReceiptSchema.parse(result));
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : t("rd.submission_failed"),
      );
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p role="status">{t("rd.checking_email_verification")}</p>;
  if (receipt)
    return (
      <section role="status" className="space-y-4 rounded-lg border border-border p-5">
        <h2 className="text-lg font-semibold">{t("rd.request_received")}</h2>
        <p>
          {t("rd.request_reference", { reference: receipt.requestId })}
        </p>
        <p>
          {t("rd.request_assigned_inbox", { inbox: receipt.assignedTo })}
        </p>
        <p className="text-sm text-muted-foreground">
          {receipt.confirmation === "sent"
            ? t("rd.confirmation_sent")
            : receipt.confirmation === "queued"
              ? t("rd.confirmation_queued")
              : t("rd.confirmation_unconfirmed")}
        </p>
        <a href="/" className="underline">
          {t("rd.back_to_homepage")}
        </a>
      </section>
    );

  return (
    <div className="space-y-5">
      {!verified ? (
        <form onSubmit={verifyEmail} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("rd.verify_email_explanation")}
          </p>
          <div className="space-y-2">
            <Label htmlFor="request-email">{t("rd.email_address")}</Label>
            <Input
              id="request-email"
              type="email"
              autoComplete="email"
              required
              maxLength={255}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setLinkSent(false);
              }}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy
              ? t("rd.sending")
              : linkSent
                ? t("rd.resend_verification_link")
                : t("rd.send_verification_link")}
          </Button>
          {linkSent && (
            <p role="status" className="text-sm">
              {t("rd.check_verification_email")}
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm">
            {t("rd.verified_email")}: <strong>{user?.email}</strong>
          </p>
          <div className="space-y-2">
            <Label htmlFor="software-request">{t("rd.software_needed")}</Label>
            <Textarea
              id="software-request"
              rows={10}
              maxLength={REQUEST_TEXT_LIMIT}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("rd.request_placeholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("rd.accepted_formats")}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-pdf">{t("rd.pdf_attachment_optional")}</Label>
            <Input
              id="request-pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setPdf(event.target.files?.[0] ?? null)}
            />
          </div>
          <div hidden aria-hidden="true">
            <label htmlFor="request-website" data-no-translate>Leave this empty</label>
            <input
              id="request-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? t("rd.submitting") : t("rd.submit_request")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("rd.privacy_notice")}
          </p>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
