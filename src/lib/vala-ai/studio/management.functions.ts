import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { studioOwner, studioViewer } from "./auth.functions";

const PROVIDERS = [
  ["Stripe", "Cards and wallets through Stripe Checkout."],
  ["PayPal", "PayPal Checkout with REST credentials."],
  ["Dodo Payments", "Global checkout sessions through Dodo Payments."],
  ["Cashfree", "Cashfree Payment Links for cards, UPI, and wallets."],
  ["Razorpay", "Razorpay Payment Links for cards, UPI, and wallets."],
  ["YooKassa", "Cards, SBP, and wallets through YooKassa."],
  ["LigdiCash", "Mobile money checkout in West Africa."],
  ["Whop", "Global checkout through Whop."],
  ["Paddle", "Merchant of record checkout through Paddle Billing."],
];
const payment = z.object({
  n: z.string(),
  d: z.string(),
  mode: z.enum(["Test", "Live"]),
  key: z.string().max(10000),
});
const alias = z.object({
  n: z.string().trim().min(1).max(100),
  m: z.string().max(200),
  def: z.boolean().optional(),
  fast: z.boolean().optional(),
});
const paymentStorage = payment.omit({ key: true }).extend({ credential: z.string().nullable() });
const stored = z.object({ payments: z.array(paymentStorage), aliases: z.array(alias) });

async function configuration() {
  const { one } = await import("../db.server");
  const saved = one<{ value_json: string; updated_at: string }>(
    "select value_json, updated_at from settings where key = 'studio.management'",
  );
  return {
    value: saved
      ? stored.parse(JSON.parse(saved.value_json))
      : {
          payments: PROVIDERS.map(([n, d]) => ({
            n: n!,
            d: d!,
            mode: "Test" as const,
            credential: null,
          })),
          aliases: [],
        },
    version: saved?.updated_at ?? null,
  };
}

export const loadStudioManagementFn = createServerFn({ method: "GET" })
  .middleware([studioViewer])
  .handler(async ({ context }) => {
    const owner = context.studioOperator.role === "owner";
    const { all } = await import("../db.server");
    const { modelStatus } = await import("../model.server");
    const model = await modelStatus();
    const config = owner ? await configuration() : null;
    return {
      payments:
        config?.value.payments.map(({ credential, ...p }) => ({
          ...p,
          key: credential ? "configured" : "",
        })) ?? [],
      aliases: config?.value.aliases ?? [],
      version: config?.version ?? null,
      modelNames: model.model ? [model.model] : [],
      ownerData: owner
        ? {
            people: all<{ email: string; role: string; last_seen_at: string }>(
              "select email,role,last_seen_at from people order by last_seen_at desc limit 50",
            ),
            chat: all<{ role: string; content: string; created_at: string }>(
              "select role,content,created_at from chat_messages order by created_at desc limit 50",
            ),
          }
        : null,
    };
  });

export const saveStudioManagementFn = createServerFn({ method: "POST" })
  .middleware([studioOwner])
  .inputValidator((data: unknown) =>
    z
      .object({
        payments: z.array(payment).max(20),
        aliases: z.array(alias).max(50),
        version: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const current = await configuration();
    if (data.version !== current.version)
      throw new Error("Configuration changed. Refresh before saving.");
    if (new Set(data.aliases.map((a) => a.n)).size !== data.aliases.length)
      throw new Error("Model alias names must be unique.");
    if (
      new Set(data.payments.map((p) => p.n)).size !== data.payments.length ||
      data.payments.some((p) => !PROVIDERS.some(([name]) => name === p.n))
    )
      throw new Error("Unknown or duplicate payment method.");
    const { encryptAiCredential } = await import("@/lib/ai-credentials.server");
    const payments = data.payments.map(({ key, ...p }) => {
      const old = current.value.payments.find((v) => v.n === p.n);
      return {
        ...p,
        credential:
          key === "configured" ? (old?.credential ?? null) : key ? encryptAiCredential(key) : null,
      };
    });
    const { one, run, tx } = await import("../db.server");
    tx(() => {
      const observed = one<{ updated_at: string }>(
        "select updated_at from settings where key = 'studio.management'",
      );
      if ((observed?.updated_at ?? null) !== current.version)
        throw new Error("Configuration changed during save. Refresh before retrying.");
      run(
        "insert into settings(key,value_json,updated_at,updated_by) values('studio.management',?,?,?) on conflict(key) do update set value_json=excluded.value_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by",
        JSON.stringify({ payments, aliases: data.aliases }),
        new Date(
          Math.max(Date.now(), Date.parse(observed?.updated_at ?? "") + 1 || 0),
        ).toISOString(),
        context.studioOperator.id,
      );
    });
    const { audit } = await import("./developer/developer.server");
    await audit("studio.management.save", {
      paymentMethods: payments.length,
      aliases: data.aliases.length,
    });
    return { ok: true };
  });
