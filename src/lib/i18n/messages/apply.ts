/** Role applications (src/routes/apply.$role.tsx). English only. */
export const APPLY_MESSAGES = {
  "apply.sign_in_first":
    "Sign in or create an account to apply — your application is linked to it.",
  "apply.submitted": "Application submitted",
  "apply.already_applied": "You have already applied",
  "apply.failed": "The application could not be submitted.",
  "apply.number": ["Application number", "label above an application number"],
  "apply.status": ["Status: {status}", "application status, e.g. pending"],
  "apply.next": "The team reviews it and you are notified in your account when the status changes.",
  "apply.home": "Back to home",
  "apply.no_payment": "No payment is taken on this form.",
  "apply.not_open":
    "Online applications for this role are not open yet — there is no hiring system connected to this form, so nothing would reach the team. Please do not submit personal details here.",

  // Manager queues (RoleApplicationsQueue)
  "apply.queue.eyebrow": "Applications",
  "apply.queue.title_franchise": "Franchise applications",
  "apply.queue.title_influencer": "Influencer applications",
  "apply.queue.subtitle":
    "Submitted through the website. Decisions are recorded, audited and sent to the applicant.",
  "apply.queue.search": ["Search", "placeholder of the search box"],
  "apply.queue.filter_open": "Open (pending, in review)",
  "apply.queue.filter_all": "All",
  "apply.queue.loading": "Loading applications",
  "apply.queue.empty": "No applications here.",
  "apply.queue.review": ["Start review", "moves an application to in review"],
  "apply.queue.approve": ["Approve", "approves an application"],
  "apply.queue.reject": ["Reject", "rejects an application"],
  "apply.queue.reason": "Reason for rejection (sent to the applicant)",
  "apply.queue.confirm_reject": "Reject application",
  "apply.queue.decided": "Application {status}.",
} as const;
