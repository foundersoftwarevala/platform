# Vala AI — OpenAI through AI API Manager (design, not implemented)

Status: **proposal awaiting approval**. Nothing in this document is built, and no OpenAI
request has been made from this machine.

## Today

- Vala AI calls only the local llama.cpp server (`src/lib/vala-ai/model.server.ts`).
- Settings reject any model URL that is not loopback or private
  (`PATCH /settings {model_url:"https://api.openai.com"}` → 400).
- AI API Manager's gateway (`src/lib/ai-gateway.server.ts`) already owns providers, models and
  keys: `resolveAiTarget` picks an active, approved `api_services` row; keys are stored encrypted
  (AES-256-GCM, `AI_API_CREDENTIAL_ENCRYPTION_KEY`); `aiComplete({ module, messages, json,
maxTokens, temperature, serviceId?, serviceName? })` returns `{ text, model, service }` and
  meters each call into `usage_events` with `product = module`.

## Proposal

Add a second model **source** to Vala AI, selected in Settings, owner only:

| Setting           | Values                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `model_source`    | `local` (default, today's behaviour) or `ai-api-manager`                                                                       |
| `gateway_service` | the AI API Manager service to use (by service id), chosen from a list the server reads through the gateway; never a URL or key |

`model_url` keeps its loopback/private-network rule and is used only when `model_source = local`.
No URL, key or provider configuration is stored in Vala AI.

### Code changes (Vala AI only)

1. `model.server.ts`: `chat()` dispatches on `model_source`.
   For `ai-api-manager` it calls `aiComplete({ module: "vala-ai", messages, json: Boolean(schema),
maxTokens, temperature, serviceId: gateway_service })`.
2. Structured output: OpenAI's JSON mode does not enforce Vala AI's schemas, so `chatJson()`
   keeps validating required fields and types and fails the step with "malformed JSON" as today.
3. Evidence: every model event records `source`, `service`, and the `model` the gateway reports,
   plus latency. Token counts come from `usage_events` (`product = "vala-ai"`), which the gateway
   already writes; Vala AI does not invent them.
4. `modelStatus()` for this source reports the selected service's state from AI API Manager
   (active, approved, key present) without making a paid request.
5. Errors map onto existing task states: no active service or no key → BLOCKED with that reason;
   401/403 → BLOCKED "credentials rejected"; 429/402 → BLOCKED with retry advice; 5xx → FAILED
   after the gateway's own fallback; malformed output → FAILED. Never a canned answer.

### Limits of the current gateway (would need changes to a shared file; separate approval)

- `aiComplete` takes no `AbortSignal`: cancelling a task cannot stop an in-flight provider call;
  Vala AI can only stop waiting for it.
- `aiComplete` has no request timeout of its own; Vala AI would wrap it with `model_timeout_s`,
  with the same limitation.
- `aiComplete` does not return token usage; Vala AI reads it from `usage_events` afterwards.

## Tests

Without credentials (can run locally):

- Source switch, settings validation, BLOCKED when no service is configured, mapping of
  gateway errors to task states, schema validation of provider output — against a stubbed
  `aiComplete` (clearly a test double).

With credentials (requires approval and access):

- One real request through the gateway to the configured OpenAI service, reaching the agent's
  plan step, with the `usage_events` row read back.
- Invalid key, rate limit and timeout behaviour against the real provider where safely possible.

## Blockers

- **Approval** for the design change (an external provider becomes an option).
- **A test path to real credentials**: the `api_services` / encrypted key rows and
  `AI_API_CREDENTIAL_ENCRYPTION_KEY` live on the production server and database, which this
  session cannot read; or an approved non-production OpenAI service configured in a test
  instance of AI API Manager.
