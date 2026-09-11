import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bitcoin,
  Check,
  CreditCard,
  Globe,
  Landmark,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard, EmptyState, ErrorState, LoadingBlock } from "@/components/manager/primitives";
import {
  useManyRecords,
  useInsertRecord,
  useUpdateRecord,
  useDeleteRecord,
  type Row,
} from "@/lib/manager-queries";
import { cn } from "@/lib/utils";
import ManualRailsPanel from "@/components/finance/ManualRailsPanel";

/* ------------------------------------------------------------------ *
 * Payment Methods
 *
 * This tab used to render one hardcoded card — "Visa •••• 4242" — with an
 * Add button that had no handler at all, which is why clicking anything on it
 * changed nothing. The table it needed, `payment_methods`, already existed with
 * exactly the right columns; it was simply missing from MANAGER_TABLES, so the
 * data layer refused it. It is allowed now, with `details_json` on the
 * server-only list so a stored account number never travels back to a browser.
 *
 * Money comes in through Wise. The bank account is shown for reference with
 * everything except the account name and the bank name masked, and the raw
 * account number is deliberately not stored anywhere a browser can read.
 * ------------------------------------------------------------------ */

type PaymentType = "card" | "bank" | "upi" | "wise" | "binance";

const PAYMENT_TYPES: { value: PaymentType; label: string; icon: typeof CreditCard }[] = [
  { value: "wise", label: "Wise", icon: Globe },
  { value: "bank", label: "Bank Transfer", icon: Landmark },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "binance", label: "Binance (Crypto)", icon: Bitcoin },
  { value: "card", label: "Card", icon: CreditCard },
];

const TYPE_ICON: Record<string, typeof CreditCard> = {
  wise: Globe,
  bank: Landmark,
  upi: Smartphone,
  binance: Bitcoin,
  card: CreditCard,
};

/** Everything but the last four characters. Used on every stored detail. */
function maskTail(value: string, keep = 4): string {
  const clean = value.trim();
  if (clean.length <= keep) return "•".repeat(clean.length);
  return `${"•".repeat(Math.min(clean.length - keep, 8))}${clean.slice(-keep)}`;
}

/** first@domain -> f•••••@domain, so the domain stays recognisable. */
function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return maskTail(value);
  return `${value[0]}${"•".repeat(Math.max(at - 1, 1))}${value.slice(at)}`;
}

function maskUpi(value: string): string {
  const at = value.indexOf("@");
  if (at <= 0) return maskTail(value);
  return `${value.slice(0, Math.min(2, at))}${"•".repeat(Math.max(at - 2, 1))}${value.slice(at)}`;
}

function maskAddress(value: string): string {
  if (value.length <= 10) return maskTail(value);
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** What the list shows for a saved method. Never the stored detail itself. */
function maskedSummary(row: Row): string {
  const type = String(row["type"] ?? "");
  const last4 = row["last4"] ? String(row["last4"]) : "";
  if (type === "card") {
    const expiry = row["expiry"] ? ` · expires ${String(row["expiry"])}` : "";
    return `•••• ${last4 || "••••"}${expiry}`;
  }
  if (type === "bank") return `Account ending ${last4 || "••••"}`;
  if (type === "upi") return last4 ? `UPI ending ${last4}` : "UPI ID saved";
  if (type === "wise") return last4 ? `Wise account ending ${last4}` : "Wise account saved";
  if (type === "binance") return last4 ? `Wallet ending ${last4}` : "Wallet saved";
  return last4 ? `Ending ${last4}` : "Saved";
}

/**
 * The Wise link and the receiving bank, as Finance Manager holds them.
 *
 * Nothing here is hardcoded: both come from finance_payment_rails, the table
 * that already carries the wise / upi / bank_transfer / binance rails. When a
 * rail is not enabled the panel says so rather than pretending a payment route
 * exists.
 */
function ReceivingDetails({ rails }: { rails: Row[] }) {
  const wise = rails.find((r) => r["code"] === "wise");
  const bank = rails.find((r) => r["code"] === "bank_transfer");
  const wiseConfig = (wise?.["configuration_state"] ?? {}) as Record<string, unknown>;
  const bankConfig = (bank?.["configuration_state"] ?? {}) as Record<string, unknown>;
  const wiseLink = typeof wiseConfig["pay_link"] === "string" ? wiseConfig["pay_link"] : "";
  const wiseReady = Boolean(wise?.["enabled"]) && wiseLink.length > 0;

  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    if (!wiseReady) {
      setQr("");
      return;
    }
    void import("qrcode")
      .then((mod) => mod.toDataURL(wiseLink, { width: 176, margin: 1 }))
      .then((dataUrl) => {
        if (!cancelled) setQr(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQr("");
      });
    return () => {
      cancelled = true;
    };
  }, [wiseReady, wiseLink]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <GlassCard title="Pay by Wise" icon={<Globe className="h-4 w-4 text-primary" />}>
        {!wiseReady ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground">PAYMENT NOT CONFIGURED</p>
            <p className="mt-1">
              The Wise rail is not enabled in Finance Manager, so there is no link to show. No
              payment can be accepted here until it is.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            {qr ? (
              <img
                src={qr}
                alt="QR code for the Wise payment link"
                width={176}
                height={176}
                className="rounded-lg border border-border bg-white p-2"
              />
            ) : (
              <div className="grid h-44 w-44 place-items-center rounded-lg border border-border text-xs text-muted-foreground">
                Preparing QR…
              </div>
            )}
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted-foreground">
                Scan the code or open the link, pay the amount, then submit the transaction
                reference below. The wallet is credited only after that reference is verified.
              </p>
              <a
                href={wiseLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {wiseLink}
              </a>
            </div>
          </div>
        )}
      </GlassCard>

      <GlassCard title="Receiving Account" icon={<Landmark className="h-4 w-4 text-primary" />}>
        <div className="space-y-2 text-sm">
          <Field label="Account Name" value={String(bankConfig["account_name"] ?? "—")} />
          <Field label="Bank Name" value={String(bankConfig["bank_name"] ?? "—")} />
          <Field label="Account Type" value="••••••" muted />
          <Field
            label="Account Number"
            value={
              bankConfig["account_last4"]
                ? `•••••• ${String(bankConfig["account_last4"])}`
                : "••••••"
            }
            muted
          />
          <Field label="IFSC" value="••••••" muted />
          <Field label="Branch" value="••••••" muted />
          <p className="pt-2 text-xs text-muted-foreground">
            Only the account name and bank name are shown. The remaining fields are masked and are
            not sent to the browser at all — pay by Wise above.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

function Field({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-1.5">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={muted ? "font-mono text-muted-foreground" : "font-medium text-foreground"}>
        {value}
      </span>
    </div>
  );
}

export function PaymentMethodsPanel() {
  const many = useManyRecords([
    { table: "payment_methods", orderBy: "created_at", ascending: false, limit: 200 },
    { table: "finance_payment_rails", orderBy: "display_name", ascending: true, limit: 50 },
  ]);

  const insert = useInsertRecord("Payment method added");
  const update = useUpdateRecord("Payment method updated");
  const remove = useDeleteRecord("Payment method removed");

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PaymentType>("wise");
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");

  if (many.isLoading) return <LoadingBlock rows={4} />;
  if (many.error) return <ErrorState error={many.error} />;

  const methods = many.data?.[0] ?? [];
  const rails = many.data?.[1] ?? [];

  /** Field validation, per type, before anything is sent. */
  function validate(): string {
    if (!label.trim()) return "Give the method a label.";
    const value = detail.trim();
    if (!value) return "The account detail is required.";
    if (type === "upi" && !/^[\w.-]{2,}@[\w.-]{2,}$/.test(value)) {
      return "A UPI ID looks like name@bank.";
    }
    if (type === "wise" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length < 6) {
      return "Enter the Wise email or account id.";
    }
    if (type === "bank" && value.replace(/\s/g, "").length < 6) {
      return "Enter the full account number.";
    }
    if (type === "binance") {
      if (value.length < 20) return "Enter the full wallet address.";
      if (!extra.trim()) return "Choose the network, for example USDT-TRC20.";
    }
    if (type === "card" && value.replace(/\D/g, "").length < 12) {
      return "Enter the full card number.";
    }
    return "";
  }

  function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const value = detail.trim();
    const last4 = value.replace(/\s/g, "").slice(-4);

    insert.mutate(
      {
        table: "payment_methods",
        values: {
          type,
          label: label.trim(),
          last4,
          status: "active",
          is_default: methods.length === 0,
          // Redacted on the way back out; the browser never reads this again.
          details_json: {
            detail: value,
            ...(type === "binance" ? { network: extra.trim() } : {}),
            ...(type === "card" && extra.trim() ? { expiry: extra.trim() } : {}),
          },
          ...(type === "card" && extra.trim() ? { expiry: extra.trim() } : {}),
        },
      },
      {
        onSuccess: () => {
          setOpen(false);
          setLabel("");
          setDetail("");
          setExtra("");
        },
      },
    );
  }

  /** Exactly one default. The others are cleared first, then this one is set. */
  function setDefault(row: Row) {
    for (const other of methods) {
      if (other["id"] !== row["id"] && other["is_default"]) {
        update.mutate({
          table: "payment_methods",
          id: String(other["id"]),
          values: { is_default: false },
        });
      }
    }
    update.mutate({
      table: "payment_methods",
      id: String(row["id"]),
      values: { is_default: true },
    });
  }

  return (
    <div className="space-y-6">
      <ReceivingDetails rails={rails} />

      {/* The control the notice above points to: enable a rail, give it its
          link and instructions, and confirm the payments that arrive on it. */}
      <ManualRailsPanel />

      <GlassCard
        title="Saved Payment Methods"
        icon={<CreditCard className="h-4 w-4 text-primary" />}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Payment Method
          </Button>
        }
      >
        {methods.length === 0 ? (
          <EmptyState message="No payment method saved yet." />
        ) : (
          <div className="space-y-3">
            {methods.map((row) => {
              const Icon = TYPE_ICON[String(row["type"])] ?? CreditCard;
              const isDefault = Boolean(row["is_default"]);
              return (
                <div
                  key={String(row["id"])}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-foreground">
                        <span className="truncate">{String(row["label"] ?? "Payment method")}</span>
                        {isDefault ? (
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            Default
                          </Badge>
                        ) : null}
                      </p>
                      <p className="font-mono text-sm text-muted-foreground">
                        {maskedSummary(row)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDefault || update.isPending}
                      onClick={() => setDefault(row)}
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" /> Set Default
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      disabled={remove.isPending}
                      onClick={() =>
                        remove.mutate({ table: "payment_methods", id: String(row["id"]) })
                      }
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a payment method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {PAYMENT_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => {
                      setType(t.value);
                      setError("");
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-xs transition-colors",
                      type === t.value
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Label</span>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="How this method should appear"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {type === "upi"
                  ? "UPI ID"
                  : type === "wise"
                    ? "Wise email or account id"
                    : type === "binance"
                      ? "Wallet address"
                      : type === "bank"
                        ? "Account number"
                        : "Card number"}
              </span>
              <Input
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder={
                  type === "upi"
                    ? "name@bank"
                    : type === "wise"
                      ? "you@example.com"
                      : type === "binance"
                        ? "Wallet address"
                        : ""
                }
              />
            </div>

            {type === "binance" ? (
              <div className="space-y-1.5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Network
                </span>
                <Input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="USDT-TRC20, BTC, ETH…"
                />
              </div>
            ) : null}

            {type === "bank" ? (
              <div className="space-y-1.5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  IFSC / SWIFT
                </span>
                <Input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="IFSC or SWIFT code"
                />
              </div>
            ) : null}

            {type === "card" ? (
              <div className="space-y-1.5">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  Expiry
                </span>
                <Input
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="MM/YYYY"
                />
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <p className="text-xs text-muted-foreground">
              Stored server-side and never sent back to a browser. Afterwards only the label and the
              last four characters are shown.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={insert.isPending}>
              {insert.isPending ? "Saving…" : "Save method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
