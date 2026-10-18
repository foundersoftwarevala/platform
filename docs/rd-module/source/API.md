# API

All server logic is exposed as TanStack Start server functions (typed RPC) — there are no
Supabase Edge Functions and no public REST endpoints. Each function validates its input
with Zod, performs the write with the service-role Supabase client, and (for Pro Manager)
appends an audit row.

Call them from components with `useServerFn`:

```ts
const acknowledge = useServerFn(acknowledgeAlert);
await acknowledge({ data: { id } });
```

## R&D — `src/lib/rnd-data.functions.ts`

| Function | Purpose |
| --- | --- |
| `createIdea` | Add an idea to Future Lab |
| `voteIdea` | Increment idea votes |
| `updateIdeaStatus` | Move an idea between statuses |
| `createPrototype` | Register a prototype build |
| `updatePrototypeProgress` | Update progress / completed hours |
| `saveImpactAnalysis` | Persist an impact scoring run |
| `submitFeedback` / `voteFeedback` | Feedback portal intake and voting |
| `voteDecision` / `setDecisionStatus` | Decision board voting and resolution |
| `markNotificationsRead` / `dismissNotification` | Notification state |
| `createTransaction` | Append an R&D wallet ledger entry |
| `upsertTechnology` | Add or update a technology radar entry |
| `savePipelineItem` / `movePipelineItem` | Innovation pipeline CRUD and stage moves |
| `saveIdeaEvaluation` | Store an AI idea score |
| `saveChatMessage` | Persist an AI assistant turn |

## Pro Manager — `src/lib/pm-data.functions.ts`

| Function | Purpose |
| --- | --- |
| `setProUserStatus` | Change a registry user's status |
| `createTicket` / `updateTicketStatus` | Support request lifecycle |
| `updateIssue` | Issue / bug tracker updates |
| `updateAssistSession` | Premium assist session state |
| `updatePromise` | Promise & SLA tracker updates |
| `updateUpgrade` / `updateRenewal` | Upgrade and renewal workflows |
| `acknowledgeAlert` | Acknowledge a system alert |
| `resolveEscalation` | Resolve or reject an escalation |
| `updateQualityAlert` | Acknowledge a quality pattern |
| `decideRequest` | Approve / reject a governance decision |
| `toggleSetting` | Flip a non-locked setting |
| `generateReport` | Create a report record |
| `exportAuditTrail` | Return the audit trail as CSV |
| `saveSatisfactionPrediction` | Persist an AI churn prediction |
| `startConversation` / `updateConversation` / `sendHelpdeskMessage` | AI helpdesk |

Every function above records an entry in `pm_audit_logs`.

## AI

`runRnDAIRequest` (`src/lib/rnd-ai.functions.ts`) and `runProManagerAIRequest`
(`src/lib/pm-ai.functions.ts`) accept `{ type, data }` and dispatch to the prompt
catalogue in the matching `*-ai.server.ts` module, which calls the Lovable AI Gateway
(google/gemini-3.7-flash) with `LOVABLE_API_KEY`.

- R&D types: chat, idea_evaluation, trend_analysis, prototype_plan, impact_assessment,
  competitor_analysis, tech_stack_recommendation, research_synthesis,
  innovation_brainstorm, patent_landscape, risk_mitigation, resource_optimization,
  auto_proposal, technology_radar, experiment_design.
- Pro Manager types: helpdesk_reply, issue_fix, churn_risk, escalation_summary,
  decision_recommendation, sla_advice, health_analysis, quality_pattern,
  compliance_review, usage_advice.

Gateway failures are mapped to user-safe messages (rate limit 429, credits 402) and
logged as structured `ai_gateway_error` entries.

## Reads

Reads do not use server functions: hooks in `src/hooks/useRnDData.ts` and
`src/hooks/useProManagerData.ts` query Supabase directly through the publishable client,
constrained by read-only RLS policies, with hard row caps and paginated variants for
large logs.
