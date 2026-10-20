import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  REQUEST_PDF_LIMIT,
  REQUEST_TEXT_LIMIT,
  softwareRequestReceiptSchema,
  type SoftwareRequestReceipt,
} from "@/lib/rd-module/public-request";

export function RequestSoftwareForm() {
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
        problem instanceof Error ? problem.message : "We could not send your verification link.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session?.access_token || !verified) {
      setError("Please verify your email before submitting.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!text.trim() && !pdf) throw new Error("Describe your software or attach a PDF.");
      if (pdf && (pdf.size === 0 || pdf.size > REQUEST_PDF_LIMIT))
        throw new Error("Choose a nonempty PDF, 10 MB or smaller.");
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
            : "Your request could not be submitted. Please retry.";
        throw new Error(message);
      }
      setReceipt(softwareRequestReceiptSchema.parse(result));
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "Your request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p role="status">Checking email verification...</p>;
  if (receipt)
    return (
      <section role="status" className="space-y-4 rounded-lg border border-border p-5">
        <h2 className="text-lg font-semibold">Your request has been received</h2>
        <p>
          Reference: <strong>{receipt.requestId}</strong>
        </p>
        <p>
          Assigned to the {receipt.assignedTo} inbox. We will review it and contact you by email.
        </p>
        <p className="text-sm text-muted-foreground">
          {receipt.confirmation === "sent"
            ? "Your confirmation email was sent."
            : receipt.confirmation === "queued"
              ? "Your confirmation email is queued for delivery. Your request is saved."
              : "Your request is saved. Confirmation email delivery could not be confirmed; keep your reference number."}
        </p>
        <a href="/" className="underline">
          Back to homepage
        </a>
      </section>
    );

  return (
    <div className="space-y-5">
      {!verified ? (
        <form onSubmit={verifyEmail} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Verify your email to send a request. No password or signup form.
          </p>
          <div className="space-y-2">
            <Label htmlFor="request-email">Email address</Label>
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
            {busy ? "Sending..." : linkSent ? "Resend verification link" : "Send verification link"}
          </Button>
          {linkSent && (
            <p role="status" className="text-sm">
              Check your email and open the verification link to return here. Check spam too.
            </p>
          )}
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm">
            Verified email: <strong>{user?.email}</strong>
          </p>
          <div className="space-y-2">
            <Label htmlFor="software-request">What software do you need?</Label>
            <Textarea
              id="software-request"
              rows={10}
              maxLength={REQUEST_TEXT_LIMIT}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type freely or paste from WhatsApp, an email or a document. No special format needed."
            />
            <p className="text-xs text-muted-foreground">
              Use any text format or language. Text, a PDF, or both.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="request-pdf">PDF attachment (optional, up to 10 MB)</Label>
            <Input
              id="request-pdf"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setPdf(event.target.files?.[0] ?? null)}
            />
          </div>
          <div hidden aria-hidden="true">
            <label htmlFor="request-website">Leave this empty</label>
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
            {busy ? "Submitting..." : "Submit request"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Your request and attachment are shared privately with the R&D team. Do not include
            passwords or payment details.
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
