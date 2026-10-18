# Connect-Hub Chat Manager Feature Matrix

Scope is limited to the Chat Manager experience and functionality applicable to
the Software Vala Control Panel. The reference UI was audited across its
Workspace, Governance, Workflow, Communication, Intelligence, and Operations
areas, along with its responsive and interaction tests. The reference registers
actions in client-side state; its sample rows, metrics, and staged actions are
not a persistent production backend and are not treated as Software Vala data.

| Feature | Reference location / implementation | Software Vala equivalent | Reuse? | Adapt? | Missing? | Priority |
|---|---|---|---|---|---|---|
| Manager route and workspace shell | Main Chat Manager workspace | `/chat-manager` inside the existing Control Panel; canonical auth remains in place | Yes | Yes | No known route gap | P1 |
| Conversation queue and views | Workspace conversations, operational views | VPS-backed queue and views in [sections.tsx](./src/components/chat-manager/sections.tsx) and `chat_manager_queue` | Yes | Yes | Live deployment verification | P1 |
| Search and filters | Conversation/customer search and queue filters | Parameterized server queue search and status, priority, handler, AI, date, waiting, lead/task, language and agent filters | Yes | Yes | Product-level filters from other modules are partial | P1 |
| Conversation inspection | Selected conversation workspace | [oversight.tsx](./src/components/chat-manager/oversight.tsx), transcript paging and detail panel | Yes | Yes | Authenticated runtime verification | P1 |
| Message composition and operations | Composer, message actions, moderation UI | Existing canonical Chat messages, manager reply, moderation, correction, restore and immutable originals | Yes | Yes | Live persistence/realtime verification | P1 |
| Assignment, priority, lifecycle and handoff | Routing and conversation controls | Permission-checked atomic VPS manager operations, human handoff and status controls | Yes | Yes | End-to-end operator verification | P1 |
| Participants and roles | Member management and governance screens | Participant controls and role-permission matrix with audit | Yes | Yes | Deployed RBAC/grant verification | P1 |
| Reactions, receipts and presence | Message and participant experience | Existing Chat reactions, read/delivery state and presence APIs | Yes | Yes | Realtime/browser verification; presence remains on its existing hosted channel | P1 |
| Attachments and media | File attachment and media preview UI | Existing Storage upload/signed URLs and Chat attachment metadata | Yes | Yes | Cross-store ownership and live download verification | P1 |
| Translation | Communication language support | Existing translation pipeline with canonical Chat translation rows and a VPS claim/finish adapter | Yes | Yes | Deployed function privilege and live provider verification | P1 |
| AI assistance and handoff | Intelligence/AI management | Existing AI gateway, AI CEO registry, agent runs, reply persistence and human escalation | Yes | Yes | Canonical bot identity/provider/runtime verification; provider metering remains a separate boundary | P1 |
| Worker and queue monitoring | Operations health and workflow views | Monitor reads existing worker/queue, provider, AI and translation tables when available | Yes | Yes | Per-worker coverage and real runtime state remain unverified | P1 |
| Task and Lead links | Conversation workflow actions | Existing Task Manager `openTask`, Lead Manager records, canonical Chat link records and reverse links | Yes | Yes | Task/Lead and Chat database boundary must be verified in staging | P1 |
| Audit and activity | Governance and activity views | Existing audit records and manager activity feed | Yes | Yes | Full actor/result coverage across all providers and workers is partial | P1 |
| SLA and waiting state | Workflow/SLA controls | Queue and monitor expose waiting/first-response data where source tables support it | Yes | Yes | Full target-specific SLA policy and breach alerts are not verified | P2 |
| Notifications | Workspace notifications and alerts | Existing notification stream invalidates/refetches Chat Manager data | Yes | Yes | Disconnect recovery and deduplication E2E not run | P1 |
| GIFs and stickers | Composer extras, where surfaced by reference | No verified canonical Chat GIF/sticker provider or persisted implementation | No | No | Yes; do not add sample/mock content | P3 |
| Keyboard, accessibility and responsive UX | Reference UI regression tests and mobile drawer behavior | Software Vala responsive workspace and existing accessible controls | Yes | Yes | Reference parity suite and real-device checks not run | P1 |
| Theme/language persistence | Reference header controls | Existing Control Panel theme/language systems | Yes | Yes | Full parity regression checks not run | P2 |
| Analytics, backups, integrations and system health | Reference Operations screens | Only existing Software Vala telemetry is shown; unsupported values are not synthesized | No | N/A | Applicable integrations/backup operations are not implemented in Chat Manager | P3 |

## Reuse and adaptation decisions

- Reuse the existing Control Panel session, permission system, canonical Chat,
  Task Manager, Lead Manager, AI CEO, worker, translation, Storage, audit and
  notification systems.
- Adapt the reference interaction patterns to real Software Vala operations.
  The reference's in-memory action staging is not a production implementation.
- Do not copy reference authentication, user/database models, static sample
  conversations, fake operational metrics, or unrelated Control Panel modules.
- "Missing" means not evidenced as a working production capability in this
  repository/runtime; it does not authorize substituting mock data.
