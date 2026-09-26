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
} as const;
