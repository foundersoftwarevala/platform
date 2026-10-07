import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

const require = createRequire(resolve("package.json"));
const postgres = require("postgres");
const ts = require("typescript");
const source = readFileSync(resolve("src/lib/i18n/registry.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { SUPPORTED_LANGUAGES, resolveLanguage } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const databaseUrl = process.env.I18N_DATABASE_URL ?? process.env.VPS_DATABASE_URL;
if (!databaseUrl) throw new Error("A native canonical database URL is required.");
if (new URL(databaseUrl).pathname !== "/sv_platform")
  throw new Error("Verification refuses a noncanonical database.");
const sql = postgres(databaseUrl, {
  max: 4,
  connection: { statement_timeout: 30000 },
  onnotice: () => {},
});
const report = {
  at: new Date().toISOString(),
  database: null,
  languages: [],
  limitations: [
    "This matrix verifies actual packs, memory and three translation directions. It does not certify every application screen, AI model, voice model or RTL layout.",
  ],
};
const out = process.argv.find((arg) => arg.startsWith("--out="))?.slice(6);
const verifyMigration = process.argv.includes("--verify-migration");
const databaseOnly = process.argv.includes("--database-only");

async function rollbackCheck(work) {
  const marker = new Error("verified-rollback");
  try {
    await sql.begin(async (transaction) => {
      await work(transaction);
      throw marker;
    });
  } catch (error) {
    if (error !== marker) throw error;
  }
}
try {
  const [identity] = await sql`select current_user as role, current_database() as database`;
  const rows = await sql`select code, enabled from public.i18n_languages`;
  for (const language of SUPPORTED_LANGUAGES) {
    if (!rows.some((row) => row.code === language.code && row.enabled))
      throw new Error(`Registry/database mismatch: ${language.code}`);
  }
  if (verifyMigration) {
    const migration = readFileSync(
      process.env.I18N_VERIFY_MIGRATION ??
        resolve("deploy/postgres/20261006220000_i18n_native_sessions.sql"),
      "utf8",
    )
      .replace(/^begin;\s*/i, "")
      .replace(/commit;\s*$/i, "");
    await rollbackCheck(async (transaction) => {
      await transaction.unsafe(migration);
      const [privileges] = await transaction`
        select has_table_privilege(current_user, 'public.i18n_sessions', 'SELECT,INSERT,DELETE') as session_access,
          has_table_privilege('anon', 'public.i18n_sessions', 'SELECT') as anonymous_access
      `;
      if (!privileges.session_access || privileges.anonymous_access)
        throw new Error("Native session privilege check failed.");
    });
  }
  const quotaSubject = `verification:${randomUUID()}`;
  await rollbackCheck(async (transaction) => {
    const [definition] =
      await transaction`select pg_get_functiondef('public.i18n_consume_quota(text,integer,bigint,integer)'::regprocedure) as definition`;
    if (
      !definition.definition.includes("ON CONFLICT") &&
      !definition.definition.includes("on conflict")
    )
      throw new Error("Shared quota lacks atomic conflict handling.");
    await transaction`insert into public.i18n_request_quota (subject,window_start,units) values (${quotaSubject},now(),1)`;
    const [row] =
      await transaction`select units from public.i18n_request_quota where subject=${quotaSubject}`;
    if (Number(row.units) !== 1) throw new Error("Native quota persistence failed.");
  });
  const [remaining] =
    await sql`select count(*)::int as count from public.i18n_request_quota where subject=${quotaSubject}`;
  if (remaining.count !== 0) throw new Error("Probe data was not rolled back.");
  let claimedRows = 0;
  await rollbackCheck(async (transaction) => {
    const [claim] = await transaction`
      select count(*)::int as count from public.i18n_claim_translation_jobs(${quotaSubject},1,600)
    `;
    claimedRows = claim.count;
    if (claimedRows < 0 || claimedRows > 1) throw new Error("Native queue claim limit failed.");
  });
  report.database = {
    ...identity,
    queueClaimRollback: { claimedRows, preserved: true },
    registry: SUPPORTED_LANGUAGES.length,
    migrationRollbackVerified: verifyMigration,
    quotaRollbackVerified: true,
    probeRowsRemaining: 0,
  };
  if (!databaseOnly) {
    const base = process.env.I18N_VERIFY_BASE_URL ?? "http://127.0.0.1:3000";
    const headers = {
      "Content-Type": "application/json",
      ...(process.env.INTERNAL_API_TOKEN
        ? { "x-internal-token": process.env.INTERNAL_API_TOKEN }
        : {}),
    };
    async function request(path, options = {}) {
      const started = performance.now();
      let response;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          response = await fetch(new URL(path, base), {
            ...options,
            headers: { ...headers, ...options.headers },
            signal: AbortSignal.timeout(90000),
            redirect: "error",
          });
          break;
        } catch (error) {
          if (attempt === 3) throw error;
          console.error(JSON.stringify({ path, attempt, transportError: error.message }));
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
      const body = response.status === 304 ? null : await response.json();
      return {
        status: response.status,
        milliseconds: Math.round(performance.now() - started),
        body,
        etag: response.headers.get("etag"),
        retryAfter: Number(response.headers.get("retry-after")) || 3,
      };
    }
    async function translate(source, target, text) {
      const started = performance.now();
      let result;
      let attempts = 0;
      do {
        attempts += 1;
        result = await request("/api/marketplace/translate", {
          method: "POST",
          body: JSON.stringify({
            source: source ?? "auto",
            target,
            texts: [text],
            namespace: "ui",
            context: "language-capability-verification",
            persist: false,
          }),
        });
        if (
          result.body?.translations?.[text] ||
          (result.status === 200 &&
            !["in_progress", "engine_unavailable"].includes(result.body?.pending_reason)) ||
          (result.status >= 400 && result.status !== 429 && result.status !== 503)
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(60, result.retryAfter) * 1000));
      } while (performance.now() - started < 90000);
      return { ...result, attempts, milliseconds: Math.round(performance.now() - started) };
    }
    const catalogue = await request("/api/marketplace/catalog?rows=2&perRow=1");
    const dynamicCard = catalogue.body?.rows
      ?.flatMap((row) => row.cards ?? [])
      .find((card) => typeof card.description === "string" && card.description.length > 20);
    if (!dynamicCard)
      throw new Error(
        "Real marketplace description is unavailable for dynamic-content verification.",
      );
    for (const language of SUPPORTED_LANGUAGES) {
      const record = {
        code: language.code,
        nativeName: language.nativeName,
        locale: language.locale ?? language.code,
        script: language.script,
        direction: language.direction,
        catalog: true,
        registry: resolveLanguage(language.code)?.code === language.code,
        status: "PARTIALLY_SUPPORTED",
        failures: [],
      };
      try {
        let pack = await request(`/api/i18n/pack?lang=${encodeURIComponent(language.code)}`);
        if (pack.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 61000));
          pack = await request(`/api/i18n/pack?lang=${encodeURIComponent(language.code)}`);
        }
        record.pack = {
          status: pack.status,
          count: pack.body?.count ?? 0,
          truncated: pack.body?.truncated ?? false,
          milliseconds: pack.milliseconds,
        };
        if (pack.status !== 200) record.failures.push("pack_unavailable");
        if (pack.etag) {
          const revalidation = await request(
            `/api/i18n/pack?lang=${encodeURIComponent(language.code)}`,
            { headers: { "If-None-Match": pack.etag } },
          );
          record.pack.etag = revalidation.status === 304;
        }
        const [memory] =
          await sql`select count(*)::int as rows from public.marketplace_translations where source_language='en' and target_language=${language.code} and status in ('machine','verified')`;
        record.memory = { rows: memory.rows, sourceIdentity: language.iso639_3 === "eng" };
        const forward = await translate("en", language.code, "Your cart is empty.");
        const translated = forward.body?.translations?.["Your cart is empty."];
        record.forward = {
          status: forward.status,
          milliseconds: forward.milliseconds,
          translated: Boolean(translated),
          text: translated ?? null,
          engine: forward.body?.engine ?? null,
          results: forward.body?.results,
          pendingReason: forward.body?.pending_reason ?? forward.body?.reason ?? null,
        };
        if (!translated) record.failures.push("en_to_language_unavailable");
        if (translated) {
          const reverse = await translate(language.code, "en", translated);
          const target = language.code === "hi" ? "fr" : "hi";
          const pair = await translate(language.code, target, translated);
          record.reverse = {
            status: reverse.status,
            translated: Boolean(reverse.body?.translations?.[translated]),
            results: reverse.body?.results,
            milliseconds: reverse.milliseconds,
          };
          record.pair = {
            target,
            status: pair.status,
            translated: Boolean(pair.body?.translations?.[translated]),
            results: pair.body?.results,
            milliseconds: pair.milliseconds,
          };
          if (!record.reverse.translated) record.failures.push("language_to_en_unavailable");
          if (!record.pair.translated) record.failures.push("language_pair_unavailable");
          const automatic = await translate(null, "en", translated);
          const detector = await fetch("http://127.0.0.1:5100/v1/detect", {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(30000),
            headers: {
              "content-type": "application/json",
              ...(process.env.TRANSLATE_PROVIDER_TOKEN
                ? { authorization: `Bearer ${process.env.TRANSLATE_PROVIDER_TOKEN}` }
                : {}),
            },
            body: JSON.stringify({ text: translated, k: 1 }),
          });
          if (!detector.ok) throw new Error(`Owned detector HTTP ${detector.status}`);
          const detection = await detector.json();
          const detected = detection.candidates?.[0]?.language ?? null;
          record.detection = {
            status: automatic.status,
            detected,
            translated: Boolean(automatic.body?.translations?.[translated]),
            matchesBase: resolveLanguage(detected ?? "")?.iso639_3 === language.iso639_3,
            milliseconds: automatic.milliseconds,
          };
          if (!record.detection.translated || !record.detection.matchesBase)
            record.failures.push("automatic_detection_unavailable");
        }
        if (record.failures.some((failure) => failure.includes("unavailable")))
          record.status = "ENGINE_LIMITED";
        record.ui = "requires_browser_matrix";
        const dynamic = await translate("en", language.code, dynamicCard.description);
        record.dynamic = {
          product: dynamicCard.id,
          status: dynamic.status,
          milliseconds: dynamic.milliseconds,
          translated: Boolean(dynamic.body?.translations?.[dynamicCard.description]),
          results: dynamic.body?.results,
        };
        if (!record.dynamic.translated) record.failures.push("dynamic_content_unavailable");
        if (record.failures.some((failure) => failure.includes("unavailable")))
          record.status = "ENGINE_LIMITED";
        record.chat = "requires_independent_model_verification";
        record.rtl =
          language.direction === "rtl" ? "requires_layout_verification" : "not_applicable";
      } catch (error) {
        record.status = "ENGINE_LIMITED";
        record.failures.push(error instanceof Error ? error.name : "request_error");
        record.error = error instanceof Error ? error.message : "request_error";
      }
      report.languages.push(record);
      if (out) writeFileSync(out, JSON.stringify(report, null, 2));
      console.log(
        JSON.stringify({ code: record.code, status: record.status, failures: record.failures }),
      );
    }
  }
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      database: report.database,
      languages: report.languages.length,
      engineLimited: report.languages.filter((language) => language.status === "ENGINE_LIMITED")
        .length,
    }),
  );
} finally {
  await sql.end();
}
