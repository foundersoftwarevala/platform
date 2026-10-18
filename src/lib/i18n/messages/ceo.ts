/**
 * The AI CEO's operational screens (src/components/ai-ceo/ops/*). English only.
 *
 * These screens read registers the platform already keeps — agents, tasks,
 * automation rules, notifications, paid-API usage, security signals and AI
 * insights — so much of their copy is about where a figure came from and what
 * an empty list means. Those two ideas carry the screens, and both have to
 * survive translation, which is why the empty states are written as sentences
 * rather than as labels.
 *
 * Database table names (ai_agents, tm_tasks, …) are deliberately absent: an
 * identifier that has been translated no longer names anything.
 */
export const CEO_MESSAGES = {
  // Agents.
  "ceo.agents": ["Agents", "heading of the AI agent register"],
  "ceo.agents_loading": "Reading the agent register…",
  "ceo.agents_failed": "The agent register didn't load",
  "ceo.agents_empty": "No agents are registered yet",
  "ceo.agent_not_found": "Agent not found",
  "ceo.agent_no_id": "No agent has this identifier",
  "ceo.agent_no_tools": "No tools are wired to this agent.",
  "ceo.agent_model_and_tools": ["Model and tools", "heading over an agent's configuration"],
  "ceo.registered": ["Registered", "count of registered agents"],
  "ceo.active": ["Active", "count of agents currently active"],
  "ceo.runs_30d": ["Runs (30 days)", "how many times an agent ran in the last month"],
  "ceo.tools_wired": ["Tools wired", "distinct tools available across all agents"],
  "ceo.success_rate": ["Success rate", "share of an agent's runs that succeeded"],
  "ceo.max_tokens": ["Max tokens", "token ceiling configured for an agent"],
  "ceo.tools": ["Tools", "tools an agent may call"],
  "ceo.model": ["Model", "the AI model an agent runs on"],

  // Tasks.
  "ceo.tasks": ["Tasks", "heading of the task register"],
  "ceo.tasks_loading": "Reading the task register…",
  "ceo.tasks_failed": "The task register didn't load",
  "ceo.tasks_empty": "No tasks are recorded",
  "ceo.task_not_found": "Task not found",
  "ceo.task_no_id": "No task has this identifier",
  "ceo.task_register_records": ["What the register records", "heading over a task's stored fields"],
  "ceo.open": ["Open", "count of tasks not yet finished"],
  "ceo.past_promise_date": ["Past promise date", "open tasks whose promised date has passed"],
  "ceo.past_promise": ["Past promise", "whether one task is past its promised date"],
  "ceo.hours_estimated": ["Hours estimated", "total estimated hours across tasks"],
  "ceo.estimated": ["Estimated", "hours estimated for one task"],
  "ceo.spent": ["Spent", "minutes recorded against one task"],
  "ceo.sla": ["SLA", "hours a task was promised within"],
  "ceo.unassigned": ["unassigned", "shown where a task has no assignee"],

  // Automations.
  "ceo.automations": ["Automations", "heading of the automation register"],
  "ceo.automations_loading": "Reading the automation tables…",
  "ceo.automations_failed": "The automation tables didn't load",
  "ceo.automations_empty": "No automation rules are recorded",
  "ceo.rules": ["Rules", "count of automation rules"],
  "ceo.enabled": ["Enabled", "an automation rule that is switched on"],
  "ceo.disabled": ["Disabled", "an automation rule that is switched off"],
  "ceo.runs_recorded": ["Runs recorded", "total runs across all automation rules"],
  "ceo.source_tables": ["Source tables", "how many tables the rules were gathered from"],

  // Notifications.
  "ceo.notifications": ["Notifications", "heading of the notification register"],
  "ceo.notifications_loading": "Reading the notification register…",
  "ceo.notifications_empty": "Nothing has been raised",
  "ceo.raised": ["Raised", "count of notifications raised"],
  "ceo.unread": ["Unread", "count of notifications not yet read"],
  "ceo.kinds": ["Kinds", "how many distinct kinds of notification exist"],
  "ceo.newest": ["Newest", "date of the most recent record"],
  "ceo.read_state": ["read", "a notification that has been read"],
  "ceo.unread_state": ["unread", "a notification that has not been read"],

  // Usage and spend.
  "ceo.usage": ["API usage and spend", "heading of the paid-API usage register"],
  "ceo.usage_loading": "Reading the usage tables…",
  "ceo.usage_empty": "No usage has been recorded",
  "ceo.spend_recorded": ["Spend recorded", "money recorded against paid API calls"],
  "ceo.requests": ["Requests", "count of API requests"],
  "ceo.tokens": ["Tokens", "count of tokens consumed"],
  "ceo.providers": ["Providers", "how many paid providers appear in the usage tables"],

  // Security.
  "ceo.security": ["Security signals", "heading of the security register"],
  "ceo.security_loading": "Reading the security tables…",
  "ceo.security_empty": "No security signals are recorded",
  "ceo.signals": ["Signals", "count of security signals"],
  "ceo.unresolved": ["Unresolved", "security signals not yet closed"],
  "ceo.high_or_critical": ["High or critical", "signals at the two most serious severities"],
  "ceo.categories": ["Categories", "how many distinct categories appear"],

  // Insights.
  "ceo.insights": ["AI insights", "heading of the AI insight register"],
  "ceo.insights_loading": "Reading the insight tables…",
  "ceo.insights_empty": "No insights have been produced",
  "ceo.insights_count": ["Insights", "count of AI insights recorded"],
  "ceo.with_an_action": ["With an action", "insights that proposed something to do"],
  "ceo.sources": ["Sources", "how many systems produced these insights"],

  // Shared furniture.
  "ceo.not_measured": ["Not measured", "tooltip on a figure that has no source"],
  "ceo.shown_read_from": [
    "shown · read from",
    "joins a row count to the database table it was read from",
  ],
  // Risk and compliance, and the governed approval queue.
  "ceo.risk_compliance": ["Risk & Compliance", "heading of the risk and compliance screen"],
  "ceo.risk_loading": "Reading the risk register and the policy set…",
  "ceo.risk_failed": "The governance tables didn't load",
  "ceo.issues": ["issues", "how many risks are recorded against an area"],
  "ceo.not_scored": ["not scored", "shown where no risk in a group carries a score"],
  "ceo.compliance_status": ["Compliance Status", "heading over the policy register"],
  "ceo.effective": ["Effective", "precedes the date a policy came into force"],
  "ceo.preventive_suggestions": ["AI Preventive Suggestions", "heading over recorded mitigations"],
  "ceo.from_source": ["· from", "precedes the table a suggestion was read from"],
  "ceo.risk_monitoring": ["Risk Monitoring:", "label on the risk screen notice"],
  "ceo.risk_monitoring_note":
    "AI continuously monitors all risk vectors. Critical issues are escalated to Boss immediately.",
  "ceo.governed_decisions": ["Governed decisions", "heading of the governed approval queue"],
  "ceo.risk_word": ["risk", "follows a severity, as in high risk"],
  "ceo.impact_word": ["impact", "follows a severity, as in high impact"],
  "ceo.of_word": ["of", "joins two counts, as in 3 of 7"],
  "ceo.evidence_sourced": [
    "pieces of evidence are sourced",
    "how much of a case is measured rather than inferred",
  ],
  "ceo.confidence_word": ["confidence", "precedes a confidence percentage"],
  "ceo.awaiting_word": ["awaiting", "precedes the role that must decide"],
  "ceo.gap_blocks_approval": "— this cannot be approved until the evidence is resolved",
  "ceo.recommended_label": ["Recommended:", "precedes the recommended option"],
  "ceo.reason_placeholder": "Why — this is recorded against the decision and cannot be left blank.",
  "ceo.approve": ["Approve", "button that approves a governed decision"],
  "ceo.reject": ["Reject", "button that rejects a governed decision"],
  "ceo.cancel": ["Cancel", "button that closes the decision form"],
  "ceo.decide": ["Decide", "button that opens the decision form"],
  "ceo.request_expired":
    "This request expired and has to be raised again before anyone can act on it.",
  "ceo.decision_recorded": ["Decision recorded", "confirmation after an approval verdict"],
  // The governed queue reads these as whole sentences rather than as words
  // glued to numbers, because a fragment like "of" cannot be translated.
  "ceo.risk_badge": ["{level} risk", "severity badge, as in high risk"],
  "ceo.impact_badge": ["{level} impact", "severity badge, as in high impact"],
  "ceo.evidence_ratio": [
    "{sourced} of {total} pieces of evidence are sourced",
    "how much of a case is measured rather than inferred",
  ],
  "ceo.confidence_value": ["confidence {score}%", "the derived confidence in a decision"],
  "ceo.awaiting_role_value": ["awaiting {role}", "which role still has to decide"],
  "ceo.gap_blocks": [
    "{gap} — this cannot be approved until the evidence is resolved",
    "shown when a decision is missing the evidence to be approved",
  ],
  "ceo.recommended_prefix": ["Recommended: ", "precedes the recommended option"],
  // The learning log and the report register.
  "ceo.learning_title": ["System Learning Log", "heading of the learning log screen"],
  "ceo.learning_loading": "Reading the decision record…",
  "ceo.learning_failed": "The learning log did not load",
  "ceo.learning_empty": "No decision has reached a human yet",
  "ceo.no_recommendation": ["no recommendation was made", "shown where a decision has none"],
  "ceo.learning_note_label": ["Learning System:", "label on the learning screen notice"],
  "ceo.learning_note": [
    "Every row here is a decision somebody made and what was recorded afterwards. Nothing is retrained: a pattern is identified and left for review.",
    "what the learning log actually does",
  ],
  "ceo.reports_title": ["AI Reports", "heading of the reports screen"],
  "ceo.reports_loading": "Reading the reports that have been generated…",
  "ceo.reports_failed": "The reports did not load",
  "ceo.readable_by": ["Readable by:", "precedes the roles that may read a report"],
  "ceo.nothing_scheduled":
    "Nothing is scheduled. Reports are generated on request; no scheduler is wired to this yet.",
  "ceo.reports_note_label": ["Report Delivery:", "label on the reports screen notice"],
  "ceo.reports_note": [
    "Reports are generated on request from the operating state and the decision record. Where the data is not there, the report says so rather than estimating.",
    "what the report generator actually does",
  ],

  // The Command Center's intelligence section: what the counters cannot say.
  "ceo.ci_loading": "Reading the company operating state…",
  "ceo.ci_denied_title": [
    "This section needs executive permission",
    "shown to a signed-in reader whose roles do not include boss or admin",
  ],
  "ceo.ci_denied_body":
    "The company operating state is limited to the boss and admin roles. Your account is signed in; it simply does not carry one of those roles, so nothing from it is shown here.",
  "ceo.ci_failed_title": [
    "The operating state could not be read",
    "heading when the state source is unreachable",
  ],
  "ceo.ci_failed_body":
    "Until it answers, this section cannot say what needs attention, what has drifted or what is waiting on a person — so it says nothing rather than showing an all-clear it has not established.",
  "ceo.ci_health": ["Company Health by Domain", "heading over the per-domain health cards"],
  "ceo.ci_health_empty_title": [
    "No domain health has been established",
    "shown when no domain health has been derived yet",
  ],
  "ceo.ci_health_empty_body":
    "Health is derived from attention items and KPI thresholds. It appears once those registers hold something — it is never assumed to be green.",
  "ceo.ci_open": ["open", "how many attention items are open in a domain"],
  "ceo.ci_critical": ["critical", "how many attention items in a domain are critical"],
  "ceo.ci_kpis_at_risk": ["KPI(s) at risk", "how many KPIs in a domain have breached a threshold"],
  "ceo.ci_attention": ["Needs Attention", "heading over the open attention items"],
  "ceo.ci_attention_empty_title": [
    "Nothing is currently flagged",
    "shown when no attention item is open",
  ],
  "ceo.ci_attention_empty_body":
    "Attention items are raised by the operating state from real events and KPI breaches. An empty list here means none has been raised — not that nothing was checked.",
  "ceo.ci_waiting": ["Waiting on a Person", "heading over decisions awaiting a human answer"],
  "ceo.ci_waiting_empty_title": [
    "No approval is outstanding",
    "shown when nothing awaits human approval",
  ],
  "ceo.ci_waiting_empty_body":
    "Anything the AI proposes that needs authority appears here until a person answers it. Nothing executes while it waits.",
  "ceo.ci_requested": ["requested", "precedes the time an approval was asked for"],
  "ceo.ci_kpi_deviations": [
    "KPI Deviations",
    "heading over KPIs that have breached their thresholds",
  ],
  "ceo.ci_kpi_none_title": ["No KPI is defined yet", "shown when no KPI has been registered"],
  "ceo.ci_kpi_none_body":
    "A KPI needs a definition, a source and a threshold before anything can be said about it. None has been registered.",
  "ceo.ci_kpi_ok_title": [
    "No KPI has breached its threshold",
    "shown when every KPI is inside its range",
  ],
  "ceo.ci_kpi_ok_body": [
    "KPI(s) are being read, and each is inside the range its own definition sets.",
    "follows a count, as in 7 KPI(s) are being read",
  ],
  "ceo.ci_no_reading": ["no reading", "shown where a KPI has no measured value"],
  "ceo.ci_risks": ["Open Risks", "heading over the risk register"],
  "ceo.ci_risks_empty_title": [
    "No risk is on the register",
    "shown when no risk has been recorded",
  ],
  "ceo.ci_risks_empty_body":
    "Risks are recorded from real signals, not generated to fill this panel. An empty register is shown as empty.",
  "ceo.ci_likelihood": ["likelihood", "precedes a risk likelihood score"],
  "ceo.ci_detected": ["detected", "precedes the time a risk was first seen"],
  "ceo.ci_sources": [
    "Sources behind this section",
    "heading over the list of tables this section read",
  ],
  "ceo.ci_reread": ["Re-read the operating state", "button that refetches the operating state"],
  "ceo.ci_fresh": ["measured recently", "freshness of a very recent measurement"],
  "ceo.ci_ageing": ["measured within the day", "freshness of a measurement less than a day old"],
  "ceo.ci_stale": ["older than a day", "freshness of a measurement more than a day old"],
  "ceo.ci_never": ["never measured", "freshness where nothing has ever been measured"],
  "ceo.ci_no_timestamp": ["no timestamp", "shown where a record carries no time"],

  // The severity ladder: what a Monitoring Agent's signal earns at each band.
  "ceo.ci_ladder": ["What a signal earns", "heading over the severity routing ladder"],
  "ceo.ci_ladder_item": ["raises an item", "this severity creates something a person can work"],
  "ceo.ci_ladder_alert": ["alerts a person", "this severity sends a notification"],
  "ceo.ci_ladder_escalate": ["escalates", "this severity demands a named human response"],
  "ceo.ci_ladder_decision": [
    "opens a decision",
    "this severity opens a governed decision for approval",
  ],
  "ceo.ci_ladder_silent": ["recorded only", "this severity is watched but raises nothing"],

  // Founder AI's own health, counted in SQL.
  "ceo.ci_health_panel": ["Founder AI health", "heading over Founder AI's own operational counts"],
  "ceo.ci_h_agents": ["Agents open to work", "agents in a lifecycle state that can take work"],
  "ceo.ci_h_runs": ["Runs in flight", "agent runs currently running or waiting"],
  "ceo.ci_h_unverified": [
    "Finished, unverified",
    "runs that completed but whose outcome nobody has checked",
  ],
  "ceo.ci_h_tasks_overdue": ["Tasks overdue", "tasks past their deadline and not closed"],
  "ceo.ci_h_approvals": ["Approvals open", "approval requests nobody has answered"],
  "ceo.ci_h_ai_failed": ["AI requests failed", "AI requests that did not return OK"],
  "ceo.ci_h_cannot_file": [
    "agent(s) hold no permission to file anything, so they can only read.",
    "follows a count of agents lacking the CREATE permission",
  ],

  // The self-healing engine.
  "ceo.heal_title": ["Self-Healing", "heading of the self-healing dashboard"],
  "ceo.heal_subtitle":
    "What the engine has detected, attempted, verified and escalated — and what it is not yet allowed to do. An attempt that succeeded but was never confirmed is shown apart from one that was.",
  "ceo.heal_loading": "Reading the healing engine…",
  "ceo.heal_failed": ["The healing engine could not be read", "heading when the board cannot load"],
  "ceo.heal_failed_body":
    "The counts could not be taken, so this screen shows nothing rather than an all-clear it has not established.",
  "ceo.heal_enabled": ["Self-healing is on", "the engine is enabled"],
  "ceo.heal_disabled": ["Self-healing is off", "the engine is switched off"],
  "ceo.heal_state_unknown": [
    "engine state unknown",
    "shown when the control row could not be read",
  ],
  "ceo.heal_degraded": ["Degraded", "the engine reports a problem with itself"],
  "ceo.heal_awaiting": ["awaiting recovery", "incidents waiting for a worker"],
  "ceo.heal_blocked_by_you": ["blocked by you", "incidents a person has taken off the engine"],
  "ceo.heal_stale_locks": ["stale lock(s)", "incidents held by a worker that stopped"],
  "ceo.heal_succeeded_unverified": [
    "succeeded but unverified",
    "attempts that worked yet were never confirmed",
  ],
  "ceo.heal_incidents": ["Incidents", "how many incidents exist in total"],
  "ceo.heal_recovered": ["Auto-recovered", "incidents resolved by a verified recovery"],
  "ceo.heal_in_progress": ["In progress", "incidents currently being worked"],
  "ceo.heal_escalated": ["Escalated", "incidents handed to a person"],
  "ceo.heal_circuits": ["Circuits open", "incidents where further attempts are refused"],
  "ceo.heal_verified_attempts": [
    "Verified attempts",
    "recovery attempts that were actually confirmed",
  ],
  "ceo.heal_engine": ["Engine", "heading over the per-component status list"],
  "ceo.heal_part_detection": ["Detection", "turning a signal into an incident"],
  "ceo.heal_part_worker": ["Worker logic", "choosing and carrying out a recovery"],
  "ceo.heal_part_claim": ["Atomic claim", "two workers never take the same incident"],
  "ceo.heal_part_verification": ["Verification", "confirming a recovery actually worked"],
  "ceo.heal_part_circuit": ["Circuit breaker", "stopping a failure from being retried forever"],
  "ceo.heal_part_budget": ["Recovery budget", "limits on attempts, time and breadth"],
  "ceo.heal_part_killswitch": ["Kill switch", "the global stop"],
  "ceo.heal_part_override": ["Human override", "taking one incident off the engine"],
  "ceo.heal_part_audit": ["Audit", "the append-only record of what was tried"],
  "ceo.heal_part_actions": ["Recovery actions", "the operations the engine can perform"],
  "ceo.heal_part_scheduler": ["Scheduler", "what would run the worker on a timer"],
  "ceo.heal_scheduler_note":
    "Nothing runs the worker on a schedule yet: it needs authorization to reach the database gateway that holds these tables. The engine can decide and verify a recovery; it is not running one by itself.",
  "ceo.heal_actions": ["Recovery actions", "heading over what the engine can and cannot do"],
  "ceo.heal_actions_real": ["These act on something real:", "label over the working actions"],
  "ceo.heal_actions_unavailable": [
    "These have no implementation and are never attempted:",
    "label over the actions that do not exist yet",
  ],
  "ceo.heal_backoff_note":
    "Backoff defers the next attempt; it is not a repair and can never resolve an incident on its own.",
  "ceo.heal_budgets": ["What each failure class may spend", "heading over the recovery budgets"],
  "ceo.heal_no_budgets": ["No budget is configured", "shown when no policy could be read"],
  "ceo.heal_no_budgets_body":
    "Without a policy nothing can be recovered autonomously, which is the safe state rather than a broken one.",
  "ceo.heal_autonomous": ["heals itself", "this class may be recovered without a person"],
  "ceo.heal_human_only": ["needs a person", "this class is never recovered autonomously"],
  "ceo.heal_attempts_word": ["attempt(s)", "how many tries a class is allowed"],
  "ceo.heal_minutes_short": ["m", "minutes, abbreviated after a number"],
  "ceo.heal_scope_word": ["scope", "precedes how many rows an action may touch"],
  "ceo.heal_running_word": ["running", "how many recoveries of this class are in flight"],
  "ceo.heal_timeline": ["Every recovery, attempt by attempt", "heading over the healing timeline"],
  "ceo.heal_no_incidents": ["No healing incident has been recorded", "shown when there are none"],
  "ceo.heal_no_incidents_body":
    "Nothing has failed in a way the engine was asked to act on. This list fills from real detection; nothing is added to make it look active.",
  "ceo.heal_verified_word": ["verified", "this attempt was actually confirmed"],
  "ceo.heal_unverified_word": [
    "not verified, so this resolved nothing",
    "this attempt was never confirmed",
  ],
  "ceo.heal_detected_word": ["detected", "precedes the time an incident was noticed"],

  // AYRA: the Founder's executive secretary.
  "ceo.ayra_title": ["AYRA", "name of the Founder's executive secretary"],
  "ceo.ayra_subtitle":
    "What AYRA is connected to, what she is not and why, and what she has been asked to do. A capability that is absent is listed with its reason, because accepting work that cannot be done is worse than refusing it.",
  "ceo.ayra_loading": "Reading the capability register…",
  "ceo.ayra_failed": [
    "The capability register didn't load",
    "heading when AYRA's register cannot be read",
  ],
  "ceo.ayra_failed_body":
    "Without it this screen cannot say what AYRA is able to do, so it says nothing rather than implying she can do everything.",
  "ceo.ayra_connected": ["connected", "how many capabilities are backed by a real system"],
  "ceo.ayra_not_connected": ["not connected", "how many capabilities have no backing system"],
  "ceo.ayra_can": ["What AYRA can do", "heading over the connected capabilities"],
  "ceo.ayra_cannot": ["What AYRA cannot do", "heading over the capabilities with no backing"],
  "ceo.ayra_needs_ok": ["needs your word", "this capability requires authorization before use"],
  "ceo.ayra_confirms": [
    "confirms delivery",
    "the backing system reports whether it actually worked",
  ],
  "ceo.ayra_absent": ["absent", "label on a capability with no backing system"],
  "ceo.ayra_all_connected": ["Everything is connected", "shown when no capability is missing"],
  "ceo.ayra_all_connected_body":
    "Every capability on the register is backed by a system that exists. Nothing is being claimed that cannot be done.",
  "ceo.ayra_orders": ["What AYRA has been asked to do", "heading over the order history"],
  "ceo.ayra_no_orders_title": ["No order has been given yet", "shown when AYRA has no orders"],
  "ceo.ayra_no_orders_body":
    "Orders are kept with the Founder's own words, because a paraphrase is not an instruction. Natural-language intake is not built yet, so nothing here is simulated to fill the list.",

  // Morning AI: the operational day.
  "ceo.morning_title": ["Morning AI", "heading of the daily operational orchestrator"],
  "ceo.morning_subtitle":
    "What changed overnight, what needs attention, and the order the company should work in. Every position carries the reason that put it there.",
  "ceo.morning_loading": "Reading today's cycle…",
  "ceo.morning_failed": ["Today's cycle didn't load", "heading when the day cannot be read"],
  "ceo.morning_failed_body":
    "The day's record could not be read, so this screen cannot say what was planned or what is outstanding.",
  "ceo.morning_not_run": ["not run yet today", "status shown before a cycle exists for today"],
  "ceo.morning_run": ["Run the day", "button that produces the brief and the plan"],
  "ceo.morning_running": ["Planning…", "button label while the cycle runs"],
  "ceo.morning_close": ["Close the day", "button that writes the daily close report"],
  "ceo.morning_closing": ["Closing…", "button label while the day is being closed"],
  "ceo.morning_empty_title": ["No cycle has run today", "shown when today has no cycle yet"],
  "ceo.morning_empty_body":
    "Nothing has been analysed for today. Running the day reads the operating state, writes a brief, and orders the outstanding work — it does not assign or execute anything.",
  "ceo.morning_brief": ["Morning brief", "heading over the day's briefing"],
  "ceo.morning_brief_empty_title": [
    "The brief found nothing outstanding",
    "shown when the brief has no findings",
  ],
  "ceo.morning_brief_empty_body":
    "No attention item, KPI breach, risk, deadline or pending decision was found for this period. That is the finding, not an absence of one.",
  "ceo.morning_plan": ["The day's work, in order", "heading over the prioritised plan"],
  "ceo.morning_plan_empty_title": ["Nothing was planned", "shown when the plan has no items"],
  "ceo.morning_plan_empty_body":
    "The cycle ran and found no outstanding work to order. Nothing here is invented to fill the list.",
  "ceo.morning_planned": ["Planned", "how many items are in today's plan"],
  "ceo.morning_waiting": ["Waiting on a person", "how many items need a human answer"],
  "ceo.morning_escalations": ["Escalations", "how many items are critical"],
  "ceo.morning_completed": ["Completed", "how many planned items were completed"],
  "ceo.morning_verified": ["Verified", "how many completed items were actually verified"],
  "ceo.morning_failed_count": ["Failed", "how many planned items failed"],
  "ceo.morning_no_agent": ["no eligible agent", "shown where no agent could be suggested"],
  "ceo.morning_closed": [
    "The day is closed and the close report is written",
    "confirmation shown after the daily close",
  ],
  "ceo.morning_nothing_to_plan": [
    "Nothing outstanding was found to plan",
    "confirmation shown when the cycle ran and found no work",
  ],

  // Manager / demo / support consoles: real-data states (internal support AI, server manager, demo manager).
  "ceo.performance.role_performance": [
    "Role Performance",
    "heading of the per-role performance rates",
  ],
  "ceo.performance.loading": "Loading live data…",
  "ceo.performance.no_trend_reason": "No history of this rate is stored, so no trend can be shown.",
  "ceo.performance.not_tracked": [
    "Not tracked",
    "shown where nothing is recorded for a role or metric",
  ],
  "ceo.performance.no_trend": "No trend history",
  "ceo.performance.corrective_actions": "Suggested Corrective Actions",
  "ceo.performance.no_corrective_engine":
    "No corrective-action engine runs against these rates yet, so there are no suggestions to show.",
} as const;
