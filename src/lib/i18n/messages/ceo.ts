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
} as const;
