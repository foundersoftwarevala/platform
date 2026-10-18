# Native 140-language repair: verified evidence and release decision

## Latest completed production verification

Runtime tested: `e37733e` (native count/hydration repair), on canonical main.
The older measurements below remain historical evidence, not current results.

| Status    | Area                              | Fresh evidence                                                                                                                                                                                                                                                          |
| --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 GREEN  | Browser/SSR/RTL/layout            | 140 unique languages; 140/140 selector and reload flows pass; zero page exceptions and zero horizontal-overflow failures. Real fonts finish loading; this is not glyph-by-glyph certification.                                                                          |
| 🟢 GREEN  | Owned forward translation         | 140/140 actual forward probes accepted, including source-language identity where appropriate.                                                                                                                                                                           |
| 🟢 GREEN  | Accepted format structure         | 413/420 cases accepted after an isolated affected-case recheck; zero accepted placeholder/ICU/HTML shape mismatches. All original failures are retained.                                                                                                                |
| 🟢 GREEN  | Native DB/security                | Actual `sv_platform` / `sv_app`; numeric quota source probes and real queue claims roll back with zero probe residue; anonymous memory/glossary visibility zero, no anonymous session access or raw-account SELECT grant.                                               |
| 🟢 GREEN  | Code verification                 | 19 files / 476 native tests; focused ESLint; production build; scoped strict types with genuine generated route registration: 4 changed roots, 2,536 source files, zero changed-file errors. Unrelated dependency diagnostics were not enumerated by that scoped check. |
| 🟡 YELLOW | Model directions/detection        | Reverse 136/140; other pair 138/140; matched automatic detection 91/140; real dynamic description 137/140. 88 PARTIALLY_SUPPORTED / 52 ENGINE_LIMITED in these probes, not full-language certification.                                                                 |
| 🔴 RED    | Complete translated page coverage | All 132 non-English page samples still report partial coverage; maximum observed pending 50 and fallback 54, substantially lower than the old approximately 1,200-element baseline, but not zero.                                                                       |
| 🔴 RED    | Real format output holds          | Seven real cases remain held by the existing quality gate: Myanmar greeting; Lao, Greek and Gaelic ICU; Slovenian, Wolof and Bambara HTML. No poor output was promoted or fabricated.                                                                                   |
| 🟡 YELLOW | Credentials and acceptance limits | Positive native password/chat flows require legitimate existing credentials. All-screen semantic quality, AI/voice/glyph coverage and thousands-user cold-inference capacity remain uncertified.                                                                        |

Fresh evidence:
[140-language browser](language-browser-capability-current.json),
[native directions and detection](language-native-capability-current.json),
[420 format probes](language-format-capability-final.json),
[isolated rate/timeout recheck](language-format-transport-recheck.json),
[real quality-mode follow-up](language-owned-quality-current.json).

The initial stable format run accepted 408/420. Concurrent native verification
shared the real operator's 120-requests/minute allowance and three cases exceeded
their 90-second inference budget. After the competing run finished, all 12 cases
in the four affected languages (`sn`, `st`, `tn`, `om`) passed an isolated recheck;
five formerly unavailable cases were recovered. These are warm follow-up results,
not a cold-capacity claim. Limits, counters and caller identities were unchanged.

Direct owned-engine evidence explains the remaining holds: Myanmar returned the
unchanged English greeting; a Lao branch used the wrong script; Gaelic retained
English branches; the Greek short branch was penalized for mixed-script output.
Quality mode improved the Lao ICU result to 0.85 without persistence, but Myanmar
remained held and the Greek quality probe exceeded 180 seconds. That is not proof
that the realtime failures are repaired. Other held HTML and dynamic outputs
require genuine model/terminology work, not looser quality thresholds.

The 205 existing failed jobs were checked: all carry the private/non-catalogue
privacy rejection, not the numeric quota error. They were not blindly requeued
or deleted. Unrelated `.kilo/` work, all demos, real accounts, translation memory,
required migrations and active platform dependencies are preserved.

**Decision remains RED / NOT READY for the full requested all-surface acceptance.**
Known model/coverage work has not been relabeled as an owner decision; the
credential-dependent checks and unmeasured capacity are stated explicitly.

## Follow-up implementation (supersedes the original SSR/source-catalogue findings)

The native public catalogue now includes 13,575 existing static UI/data-object
strings as well as gated published marketplace copy. No visitor-private text is
admitted merely because a translation was requested.

Native public packs bootstrap the root locale and keyed UI on the server without
using the global Supabase server-function middleware. Explicit locale URLs take
precedence over cookies/browser detection; each request owns its bootstrap state.
The client uses the existing native pack endpoint. Held-for-review entries are
not rendered by SSR.

Homepage metadata uses the real catalogue counts and six bounded native source
templates. Missing accepted translations still fall back to source text; this
does not certify translated metadata for every locale. Uncertified hreflang
alternates remain unpublished. Personalized HTML varies on Cookie and
Accept-Language and is private/no-cache.

Production deployment now additionally gates English, Hindi and Arabic
server-rendered locale/direction and cache headers before the build swap.
The all-language browser verifier records server locale, direction, font readiness
and horizontal overflow. The new format verifier checks actual source-message
placeholders, ICU select structure and HTML through the real native translation
API with persistence disabled.

Validation before deployment: production build passed; 19 native test files /
469 tests passed; focused ESLint passed; strict checks found zero errors in 14
changed roots (1,029 transitive files), with nine diagnostics outside those
changed files. The older full-application 4,801-diagnostic baseline is not
represented as repaired.

These implementation improvements do not change the RED acceptance decision
without fresh production evidence. Original baseline measurements below are
retained as dated observations, not represented as measurements of this update.

### Fresh live findings and immediate repairs

The first fresh anonymous browser could not hydrate because nginx returned
`X-SV-Cache: STALE` HTML referencing a removed application asset (HTTP 404).
This was not a failed language selector. The canonical nginx configuration now
bypasses the legacy URI-only HTML cache; its prior configuration was preserved,
`nginx -t` passed, and the anonymous canonical homepage subsequently hydrated
with zero browser page exceptions. Deployment installs and validates this
configuration rather than leaving a VPS-only repair.

Runtime logs also identified catalogue synchronization rejecting real messages
after the queue trimmed whitespace. The trusted static catalogue now uses the
same normalization; a regression checks every real keyed message against the
allowlist. No private text was added and no real jobs were deleted.

The generated-source check previously parsed the full application repeatedly
and exceeded its existing 120-second test limit under host contention. Data
labels and rendered literals now share one scan; the generated catalogue remains
13,575 strings. The original threshold was not increased.

Final follow-up validation: 19 files / 470 tests passed, focused ESLint passed,
strict changed-file types passed and the production build passed.
Real native DB rollback verification confirmed `sv_app` / `sv_platform`, 140
registry languages, an actual preserved queue claim and zero probe quota rows.
Public API security smoke passed (200 packs, 304 ETag, rejected invalid session,
400 malformed sign-in, 403 cross-origin, 401 unauthorized operator/jobs).
Twenty-four actual locale HTML requests at concurrency four passed 24/24:
p50 482ms, p95 2,132ms, maximum 2,676ms. This is not a thousands-user capacity
certificate.

Date: 2026-10-07T02:14:22.147Z. Application build: `8b689218ab2c006473426f8d37f4f68566fc544b`.

## Final status: 🔴 RED - NOT READY

The native persistence/authentication/security foundation is repaired and deployed.
This is **not** a declaration that all 140 languages, all screens or the full
application are complete. Remaining coverage and application type errors are
engineering work, not owner decisions.

Evidence files:
[native API/model matrix](language-native-capability.json),
[all-140 browser matrix](language-browser-capability.json),
[settled deployed browser](language-settled-browser.json),
[public production smoke](language-production-smoke.json),
[actual operator/runtime check](language-operator-runtime.json).

## Status dashboard

| Status    | Area                                | Evidence                                                                                                                                                                                                                            |
| --------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 GREEN  | Registry                            | 140 enabled languages; 145 retained database records including five retired entries.                                                                                                                                                |
| 🟢 GREEN  | Native persistence                  | Real `sv_platform`, application role `sv_app`; rollback-only quota and real queue claims leave no probe rows.                                                                                                                       |
| 🟢 GREEN  | Native language dependency boundary | Source/transitive architecture tests cover server, API, client, chat adapter, migration and deployment; no Supabase SDK, REST/RPC, service environment or browser persistence fallback in that boundary.                            |
| 🟢 GREEN  | Public data privacy                 | Real anonymous memory/glossary visibility: zero rows; authenticated without account claims: zero memory rows. Backend cannot SELECT raw accounts.                                                                                   |
| 🟢 GREEN  | Native operator API                 | Actual internal operator overview, metrics and glossary: HTTP 200. Owned model reachable and ready.                                                                                                                                 |
| 🟢 GREEN  | Browser navigation                  | 140/140 real anonymous selectors, reload preferences, document direction and rendered main passed; zero page exceptions. This does not certify translated content.                                                                  |
| 🟢 GREEN  | Build and scoped tests              | Production build passed; 17 canonical test files / 458 tests passed. Focused ESLint passed. Latest two changed strict roots / 257 transitive files: zero errors; prior native integration scope: 36 roots / 487 files: zero errors. |
| 🟡 YELLOW | Owned models                        | MADLAD-400 3B CTranslate2 int8; routing 2026.09.5; fastText 176 labels; self-hosted LibreTranslate 50 base codes. Routing is not semantic certification.                                                                            |
| 🟡 YELLOW | Account password sign-in            | Secure native flow and negative/origin tests verified; positive genuine password sign-in not tested because legitimate credentials were unavailable. No account or session was fabricated.                                          |
| 🔴 RED    | Non-English page coverage           | All 132 non-English browser samples remained partial; eight English identity varieties were ready. At one second, up to 1,253 fallbacks / 1,242 pending elements.                                                                   |
| 🔴 RED    | Settled page coverage               | After 60 seconds on deployed build: Hindi 1,174 fallback / 1,160 pending; Arabic 1,208 / 1,184. Genuine anonymous quota rejection was recorded. These are not fully translated pages.                                               |
| 🔴 RED    | Full application TypeScript         | 4,801 diagnostics outside the native-language change scope. Full application typecheck does not pass.                                                                                                                               |
| 🔴 RED    | Multilingual SSR/SEO                | Initial server HTML/meta remains source-language-first English; locale-specific SSR, metadata and hreflang completion are not verified.                                                                                             |
| 🔴 RED    | Strict acceptance                   | All-screen leakage, all RTL layouts/fonts, genuine chat/AI/voice and thousands of concurrent cold-inference users remain uncertified.                                                                                               |

## Regression cause and fixes

Git blame locates the original collector defects in commit `27c8d1e9`
(2026-09-23). It proves code introduction, not the first production incident.
The collector lost remembered English sources after non-Latin rendering and
could overwrite later framework text with stale originals.

| #   | Severity | Component / cause                                                               | Repair and evidence                                                                                                                                                                        |
| --- | -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | HIGH     | Language data persisted through the unrelated gateway and wrong legacy database | Parameterized native PostgreSQL service/admin/jobs; scoped existing `sv_platform` connection, leaving other modules untouched. Real registry and memory verified.                          |
| 2   | HIGH     | Public raw memory/glossary RLS exposed historical screen text                   | Removed broad policies; preserved authorized operator access. Actual anon and claimless authenticated reads return zero rows.                                                              |
| 3   | HIGH     | Native backend account/session privilege boundaries                             | Opaque SHA256-hashed sessions; native auth functions; backend raw account SELECT denied; anonymous session/function access denied.                                                         |
| 4   | HIGH     | Cache and shared-memory privacy                                                 | Catalogue-only shared reads and public packs; private chat excluded; historical data retained rather than deleted. Architecture and pipeline regression tests passed.                      |
| 5   | HIGH     | Process-local quota races                                                       | Existing transactional PostgreSQL quotas shared across processes; actual rollback probe passed.                                                                                            |
| 6   | MEDIUM   | Original DOM source lost after translation                                      | Preserve source originals and observe characterData mutations; regression tests passed.                                                                                                    |
| 7   | MEDIUM   | Stale collector overwrote real framework updates                                | Track applied values and refresh source after genuine runtime changes; tests passed.                                                                                                       |
| 8   | MEDIUM   | Revoked language-pack entries and stale logout state                            | Restore source, invalidate protected query/translation caches and reject old in-flight replies after state replacement; tests passed.                                                      |
| 9   | MEDIUM   | Progress falsely looked ready                                                   | Refresh actual pending/fallback counters every 500 ms. Browser matrix now reports incomplete coverage honestly.                                                                            |
| 10  | MEDIUM   | Engine status response/UI mismatch                                              | Restore reachable/status/providers contract; actual operator console APIs and model readiness passed.                                                                                      |
| 11  | MEDIUM   | Unrelated auth gate hid native language sign-in                                 | Native sign-in route reachable; language operator APIs independently authorized. Native sign-out and chat sign-in link connected.                                                          |
| 12  | MEDIUM   | Canonical HTTPS origin rejected behind TLS edge                                 | Exact known canonical HTTPS origin accepted, arbitrary forwarded origins refused. Actual malformed same-origin POST 400; cross-origin 403.                                                 |
| 13  | MEDIUM   | Automatic source rejected by public API                                         | Accept explicit null or "auto", preserve omitted English default, and avoid queuing unknown source into shared memory. Regression test and deployed all-language requests verified.        |
| 14  | MEDIUM   | Owned-provider env differed from verified active runtime                        | Synchronized only native provider token to actual engine/runtime, protected env mode 600; equality checks pass without disclosing credentials.                                             |
| 15  | LOW      | Jobs GET fell through to HTML HTTP 200                                          | Explicit GET 405 with Allow: POST; technical HTTP error excluded from UI literal audit.                                                                                                    |
| 16  | LOW      | Test and verifier evidence mismatches                                           | Exclude retained mirrored worktree tests, wait for actual visible main, correct API source contract, retain error messages and bounded transport retry. Original failed evidence retained. |
| 17  | MEDIUM   | Recovery scripts did not use canonical native data                              | Seven-table native snapshot and exact-count restore passed; scratch database removed. Full external-account/schema/RLS recovery is not claimed by the subset restore.                      |

## Capability results

- Total registered and individually processed: **140**.
- Fully supported under the user's complete acceptance standard: **0**.
- Native probe PARTIALLY_SUPPORTED: **86**.
- Native probe ENGINE_LIMITED: **54**.
- Languages with a native probe finding: **54**.
- Transport/harness exceptions in final native matrix: **0**.
- Public pack HTTP 200 results: **140/140**.
- EN to language available: **140/140**.
- Language to EN available: **133/140**.
- Other language pair available: **135/140**.
- Detection plus automatic translation passed: **88/140**.
- Real dynamic product description available: **137/140**.
- NOT_SUPPORTED has not been asserted merely because a short probe failed.
- English varieties are source identity, so zero translated pack rows is expected.

Each row below is the actual native result joined to its actual browser result.
Availability is not semantic translation quality. Automatic detection probes use
short model-generated cart text; ambiguous identification is a tested-input
limitation, not proof that the entire language is impossible.
Probe failures: 52 automatic-detection findings, seven reverse-direction
findings, five other-pair findings and three dynamic-description findings.
These overlap across 54 languages; they must not be summed as 67 failed languages.

| Code    | Locale / script | Direction | Public pack rows | Native status       | EN to language | Language to EN | Other pair | Auto detection | Dynamic real product | Browser / reload | Findings                                                                                                            |
| ------- | --------------- | --------- | ---------------: | ------------------- | -------------- | -------------- | ---------- | -------------- | -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| en      | en-US / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| hi      | hi-IN / Deva    | ltr       |             2957 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| bn      | bn-BD / Beng    | ltr       |             2530 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ta      | ta-IN / Taml    | ltr       |             2556 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| te      | te-IN / Telu    | ltr       |             2518 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| mr      | mr-IN / Deva    | ltr       |             2505 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| gu      | gu-IN / Gujr    | ltr       |             2519 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| kn      | kn-IN / Knda    | ltr       |             2497 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ml      | ml-IN / Mlym    | ltr       |             2524 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| pa      | pa-IN / Guru    | ltr       |             2520 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| or      | or-IN / Orya    | ltr       |             2519 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| as      | as-IN / Beng    | ltr       |             2504 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ur      | ur-PK / Arab    | rtl       |             2601 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ne      | ne-NP / Deva    | ltr       |             2525 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| si      | si-LK / Sinh    | ltr       |             2514 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| my      | my-MM / Mymr    | ltr       |             2337 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| th      | th-TH / Thai    | ltr       |             2524 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| lo      | lo-LA / Laoo    | ltr       |             2359 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| km      | km-KH / Khmr    | ltr       |             2509 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| vi      | vi-VN / Latn    | ltr       |             2522 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| id      | id-ID / Latn    | ltr       |             2520 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ms      | ms-MY / Latn    | ltr       |             2532 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| fil     | fil-PH / Latn   | ltr       |             2521 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| zh-Hans | zh-CN / Hans    | ltr       |             2560 | ENGINE_LIMITED      | PASS           | FAIL           | FAIL       | FAIL           | PASS                 | PASS             | language_to_en_unavailable, language_pair_unavailable, automatic_detection_unavailable                              |
| zh-Hant | zh-TW / Hant    | ltr       |             2552 | ENGINE_LIMITED      | PASS           | FAIL           | FAIL       | FAIL           | FAIL                 | PASS             | language_to_en_unavailable, language_pair_unavailable, automatic_detection_unavailable, dynamic_content_unavailable |
| jv      | jv-ID / Latn    | ltr       |             2501 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ja      | ja-JP / Jpan    | ltr       |             2559 | ENGINE_LIMITED      | PASS           | FAIL           | FAIL       | FAIL           | PASS                 | PASS             | language_to_en_unavailable, language_pair_unavailable, automatic_detection_unavailable                              |
| ko      | ko-KR / Kore    | ltr       |             2515 | ENGINE_LIMITED      | PASS           | PASS           | FAIL       | PASS           | PASS                 | PASS             | language_pair_unavailable                                                                                           |
| mn      | mn-MN / Cyrl    | ltr       |             2519 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ar      | ar-SA / Arab    | rtl       |             3038 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| fa      | fa-IR / Arab    | rtl       |             2579 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ps      | ps-AF / Arab    | rtl       |             2522 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ckb     | ckb-IQ / Arab   | rtl       |             2526 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| tt      | tt-RU / Cyrl    | ltr       |             2522 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| he      | he-IL / Hebr    | rtl       |             2590 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| tr      | tr-TR / Latn    | ltr       |             2538 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| az      | az-AZ / Latn    | ltr       |             2522 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| hy      | hy-AM / Armn    | ltr       |             2502 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ka      | ka-GE / Geor    | ltr       |             2523 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| kk      | kk-KZ / Cyrl    | ltr       |             2519 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| uz      | uz-UZ / Latn    | ltr       |             2539 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ky      | ky-KG / Cyrl    | ltr       |             2504 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| tg      | tg-TJ / Cyrl    | ltr       |             2520 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| tk      | tk-TM / Latn    | ltr       |             2500 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | PASS           | FAIL                 | PASS             | dynamic_content_unavailable                                                                                         |
| ru      | ru-RU / Cyrl    | ltr       |             2572 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| uk      | uk-UA / Cyrl    | ltr       |             2528 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| be      | be-BY / Cyrl    | ltr       |             2517 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| pl      | pl-PL / Latn    | ltr       |             2519 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| cs      | cs-CZ / Latn    | ltr       |             2531 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| sk      | sk-SK / Latn    | ltr       |             2535 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| hu      | hu-HU / Latn    | ltr       |             2530 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ro      | ro-RO / Latn    | ltr       |             2528 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| bg      | bg-BG / Cyrl    | ltr       |             2532 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| sr      | sr-RS / Cyrl    | ltr       |             2540 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| hr      | hr-HR / Latn    | ltr       |             2540 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| bs      | bs-BA / Latn    | ltr       |             2483 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| sl      | sl-SI / Latn    | ltr       |             2539 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| mk      | mk-MK / Cyrl    | ltr       |             2525 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| sq      | sq-AL / Latn    | ltr       |             2527 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| el      | el-GR / Grek    | ltr       |             2532 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| it      | it-IT / Latn    | ltr       |             2536 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| fr      | fr-FR / Latn    | ltr       |             2577 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| es      | es-ES / Latn    | ltr       |             2580 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| pt      | pt-PT / Latn    | ltr       |             2579 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| pt-BR   | pt-BR / Latn    | ltr       |             2575 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| de      | de-DE / Latn    | ltr       |             2528 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| nl      | nl-NL / Latn    | ltr       |             2538 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| nl-BE   | nl-BE / Latn    | ltr       |             2538 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| da      | da-DK / Latn    | ltr       |             2540 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| sv      | sv-SE / Latn    | ltr       |             2539 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| nb      | nb-NO / Latn    | ltr       |             2541 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| fi      | fi-FI / Latn    | ltr       |             2538 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| is      | is-IS / Latn    | ltr       |             2521 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| et      | et-EE / Latn    | ltr       |             2538 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| lv      | lv-LV / Latn    | ltr       |             2543 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| lt      | lt-LT / Latn    | ltr       |             2541 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ga      | ga-IE / Latn    | ltr       |             2537 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| gd      | gd-GB / Latn    | ltr       |             2289 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| cy      | cy-GB / Latn    | ltr       |             2503 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| eu      | eu-ES / Latn    | ltr       |             2526 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ca      | ca-ES / Latn    | ltr       |             2535 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| gl      | gl-ES / Latn    | ltr       |             2525 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| mt      | mt-MT / Latn    | ltr       |             2527 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| lb      | lb-LU / Latn    | ltr       |             2492 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| af      | af-ZA / Latn    | ltr       |             2509 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| zu      | zu-ZA / Latn    | ltr       |             2512 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| xh      | xh-ZA / Latn    | ltr       |             2511 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| sw      | sw-KE / Latn    | ltr       |             2525 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| am      | am-ET / Ethi    | ltr       |             2553 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ti      | ti-ER / Ethi    | ltr       |             2369 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| so      | so-SO / Latn    | ltr       |             2503 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ha      | ha-NG / Latn    | ltr       |             2463 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| yo      | yo-NG / Latn    | ltr       |             2516 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ig      | ig-NG / Latn    | ltr       |             2498 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| rw      | rw-RW / Latn    | ltr       |             2480 | ENGINE_LIMITED      | PASS           | FAIL           | FAIL       | FAIL           | PASS                 | PASS             | language_to_en_unavailable, language_pair_unavailable, automatic_detection_unavailable                              |
| mg      | mg-MG / Latn    | ltr       |             2513 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| sn      | sn-ZW / Latn    | ltr       |             2229 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| st      | st-LS / Latn    | ltr       |             2482 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| tn      | tn-BW / Latn    | ltr       |             2448 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| om      | om-ET / Latn    | ltr       |             2462 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| sg      | sg-CF / Latn    | ltr       |             2255 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ak      | ak-GH / Latn    | ltr       |             2143 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | FAIL                 | PASS             | automatic_detection_unavailable, dynamic_content_unavailable                                                        |
| wo      | wo-SN / Latn    | ltr       |             2439 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| bm      | bm-ML / Latn    | ltr       |             2518 | ENGINE_LIMITED      | PASS           | FAIL           | PASS       | FAIL           | PASS                 | PASS             | language_to_en_unavailable, automatic_detection_unavailable                                                         |
| ff      | ff-SN / Latn    | ltr       |             2448 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ln      | ln-CD / Latn    | ltr       |             2037 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| ar-EG   | ar-EG / Arab    | rtl       |             2567 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ar-AE   | ar-AE / Arab    | rtl       |             2515 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ar-MA   | ar-MA / Arab    | rtl       |             2527 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| es-MX   | es-MX / Latn    | ltr       |             2525 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| es-AR   | es-AR / Latn    | ltr       |             2548 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| es-CO   | es-CO / Latn    | ltr       |             2517 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| es-CL   | es-CL / Latn    | ltr       |             2517 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| es-PE   | es-PE / Latn    | ltr       |             2537 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| fr-CA   | fr-CA / Latn    | ltr       |             2535 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| fr-BE   | fr-BE / Latn    | ltr       |             2528 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| fr-CH   | fr-CH / Latn    | ltr       |             2528 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| de-AT   | de-AT / Latn    | ltr       |             2535 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| de-CH   | de-CH / Latn    | ltr       |             2537 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-GB   | en-GB / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-AU   | en-AU / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-CA   | en-CA / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-IN   | en-IN / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-SG   | en-SG / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-NZ   | en-NZ / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| en-IE   | en-IE / Latn    | ltr       |                0 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| haw     | haw-US / Latn   | ltr       |             2515 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| sm      | sm-WS / Latn    | ltr       |             2504 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| to      | to-TO / Latn    | ltr       |             2417 | ENGINE_LIMITED      | PASS           | FAIL           | PASS       | FAIL           | PASS                 | PASS             | language_to_en_unavailable, automatic_detection_unavailable                                                         |
| fj      | fj-FJ / Latn    | ltr       |             2489 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| mi      | mi-NZ / Latn    | ltr       |             2527 | ENGINE_LIMITED      | PASS           | FAIL           | PASS       | FAIL           | PASS                 | PASS             | language_to_en_unavailable, automatic_detection_unavailable                                                         |
| ht      | ht-HT / Latn    | ltr       |             2423 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| gn      | gn-PY / Latn    | ltr       |             2384 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| mai     | mai-IN / Deva   | ltr       |             2484 | ENGINE_LIMITED      | PASS           | PASS           | PASS       | FAIL           | PASS                 | PASS             | automatic_detection_unavailable                                                                                     |
| dv      | dv-MV / Thaa    | rtl       |             2289 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| la      | la / Latn       | ltr       |             1760 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| eo      | eo / Latn       | ltr       |             1659 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| sd      | sd-PK / Arab    | rtl       |             1697 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| ug      | ug-CN / Arab    | rtl       |             1676 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |
| yi      | yi / Hebr       | rtl       |             1582 | PARTIALLY_SUPPORTED | PASS           | PASS           | PASS       | PASS           | PASS                 | PASS             | none in native probes                                                                                               |

## Translation coverage and English leakage

| Surface                           | Verified                                                                                  | Not certified                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Static client UI / PageTranslator | Source tracking, dynamic DOM safety, selector/reload, real progress counters              | Every translatable literal; 13,469 grandfathered source literals are not all migrated. |
| Dynamic UI / marketplace          | Real product description tested for every language; actual browser cards inspected        | Complete catalogue fields and all dynamically loaded screens.                          |
| Server / SEO                      | Real pages serve HTTP 200                                                                 | Fully localized initial HTML/title/meta/hreflang.                                      |
| APIs / memory / packs             | All native registry and pack probes; real translation directions and native memory counts | Semantic correctness of every translation.                                             |
| Chat                              | Native session and same-origin integration, private namespace isolation, sign-in link     | Positive genuine signed-in conversation translation and all chat languages.            |
| AI / voice                        | Existing architecture preserved, no replacement invented                                  | Independent model/voice coverage and all real user flows.                              |
| RTL                               | Registry direction and browser html.dir passed                                            | Every layout, mixed-direction field and font.                                          |

Leakage classification from observed deployed pages:

| Observed text                                                                                     | Classification                          | Assessment                                                         |
| ------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------ |
| Software Vala                                                                                     | BRAND                                   | Expected to remain.                                                |
| Model identifiers, API codes, paths and HTTP protocol errors                                      | TECHNICAL / NOT TRANSLATABLE            | Not UI translation failures.                                       |
| Product-specific names                                                                            | PROPER NAME only where genuinely a name | Generic categories and descriptions must not be excused as brands. |
| Share                                                                                             | MISSING TRANSLATION                     | User-facing action still English in settled non-English samples.   |
| Complete school management with student records, attendance, timetable, and parent communication. | MISSING TRANSLATION                     | Descriptive marketplace text remained English.                     |
| Native English varieties                                                                          | EXPECTED                                | Source-language identity, not missing non-English output.          |

Other sampled ASCII candidates remain explicitly unclassified pending context;
no complete all-screen leakage pass is claimed.

## Engine, scaling and performance

Actual operator overview/metrics report the owned model ready and reachable.
Native script records real per-request latency for forward/reverse/pair,
detection and dynamic content. Application response budget, in-flight joining,
bounded providers/circuits, timeout, retry and atomic quota tests passed.
The 140-language browser run used one genuine anonymous context, not forged IPs.
The later Hindi/Arabic run recorded actual 429 quota_exceeded and an Arabic
in_progress response. Warm shared packs/CDN/ETag help repeated users; this does
not demonstrate thousands of cold simultaneous inference requests.
Recorded translation-probe latency: median 14 ms,
p95 11602 ms, maximum 120386 ms.
These include bounded retries and are not a throughput or cold-load benchmark.
The Hindi cart probe returned "आपकी गाड़ी खाली है।." from the real model:
availability/format checks cannot establish correct shopping terminology.
No fabricated reviewed translation was inserted to hide that issue.

## Supabase boundary

**SUPABASE DEPENDENCY: NONE in the repaired Own Language Module runtime.**

Unrelated platform auth/storage/realtime dependencies are intentionally retained.
The existing native account tables and historical SQL directory are not a
Supabase SDK/service call. This is a scoped architectural result, not a claim
that the entire application no longer uses Supabase.

## Production parity and security

- Canonical application commit: `8b689218ab2c006473426f8d37f4f68566fc544b` on local main, GitHub main and VPS at deployment verification.
- Source: `/var/www/softwarevala`; guarded production build on localhost:3000.
- Actual serving PID: 3273064, one listener matching PM2 softwarevala-staging.
- Native PostgreSQL: existing `sv_platform`, role `sv_app`; unrelated legacy database configuration preserved.
- Engine: owned localhost:5100, routing 2026.09.5.
- Native provider disk/runtime/engine token equality checked; credentials never printed.
- Migration verified in rollback before apply; later fresh rollback-only RLS check passed.
- Public smoke: registry 200, Hindi pack 200 / native PostgreSQL, ETag 304,
  anonymous and invalid-cookie session unauthenticated, same-origin malformed
  sign-in 400, cross-origin 403, unauthorized admin/jobs 401, real catalogue 200.
- Real backup retained: `/root/backups/i18n/2026-10-06-native-release-1791329071`.
  Exact restored rows: languages 145, memory 407180, glossary 7, revisions
  16233, jobs 369035, quota 3, sessions 0. Scratch database auto-dropped.
- No fake accounts, production translations or demo records created.
- Demo URLs/masking/rebranding/mappings were not changed.
- Unrelated retained `.kilo/` work is preserved; no falsely clean-tree claim.

The browser 140 matrix was gathered on the preceding deployed 2e0d404 build;
the subsequent 8b68921 change affected API auto-source and verifiers, not the
selector/DOM implementation. The settled Hindi/Arabic evidence and final native
matrix were gathered on 8b68921. The later report-only commit, if present, does
not change the serving application artifact.

## Remaining open items and release decision

1. Complete non-English static/dynamic/marketplace coverage and context-based
   English leakage classification; do not mark current partial pages supported.
2. Resolve language-specific model/pair/detection/quality findings in the matrix;
   use legitimate reviewed terminology and model evidence, not fabricated data.
3. Complete locale-aware multilingual SSR/SEO, all RTL layouts/fonts, real
   chat/AI/voice flows, live all-language placeholder/HTML checks and measured
   target concurrency.
4. Fix the unrelated full-app 4,801 TypeScript diagnostics before claiming a
   full application typecheck pass.
5. Genuine positive password sign-in requires an authorized existing account's
   credentials; it remains unverified rather than replaced by a forged session.

**Decision: NOT READY under the strict 140-language/all-surface acceptance.**
Native foundation fixes are deployed and verified; remaining engineering work
has not been relabeled as an owner decision.

## Follow-up: numeric quotas and hydration parity

The fresh pre-repair browser matrix completed 140 languages, with 85 failing
rows and 18 page exceptions. The operator format attempt reached only 72
languages: 142 accepted cases and 71 failing rows. These are retained observations,
not successful acceptance results or proof of model limitations.

Two concrete causes were repaired:

- PostgreSQL can infer two untyped comparison parameters as text. For example,
  `'92' <= '5000000'` is false, although the numeric comparison is true.
  The engine quota reservation now explicitly compares bigint parameters;
  limits and existing counters were not raised or reset. The actual source
  function passed below-limit, equal-limit and over-limit probes against
  `sv_platform` as `sv_app`, entirely rolled back with zero probe rows.
- SSR now follows the client's reviewed regional dictionaries and product-name
  protection. Request-specific bootstrap is serialized as root loader data;
  translation-memory lookup normalizes source padding while restoring the
  original displayed whitespace.

The static source catalogue previously contained 215 strings with embedded CR
characters from Windows checkouts. Extraction now normalizes physical source
line endings before parsing, leaving escaped string content unchanged. The
trusted catalogue still contains 13,575 actual source strings; the strict
generated-source check passes on the Linux candidate.

Candidate verification: 19 native test files / 475 tests pass, changed-file
strict TypeScript reports zero errors (7 roots / 515 source files), focused
ESLint passes, and the production build passes. Browser verification now isolates
each language in a fresh anonymous context and records page exceptions against
their actual language, preventing one failed navigation from contaminating
later cases. Fresh post-deployment matrices remain necessary; this section
does not certify all 140 languages, voice/AI, signed-in flows or thousand-user
cold-inference capacity.

The first post-parity production reload still produced React hydration error
418 in Belarusian. A real isolated development server identified the exact
text mismatch: server `7557` versus browser `7,557`. Actual Chromium reports
no `be`/`be-BY` number-format support and falls back to `en-US`; the VPS Node
runtime supports Belarusian CLDR. This was not an unsupported translation model.

Catalogue counts now reuse locale-tagged, server-formatted strings from the
serialized homepage loader. The real values are unchanged, locale switches do
not reuse another language's snapshot, and metadata uses the shared registry
formatter. Real candidate browser reloads in `be`, `tk`, `ar-EG` and `pl`
subsequently recorded zero page exceptions. Updated native suite: 19 files /
476 tests pass; focused ESLint passes. Full fresh production verification is
still required before an acceptance claim.
