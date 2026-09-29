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
  "apply.conflict_title": [
    "This account already has a {kind} application",
    "shown when a vendor applies as an author or the other way round; {kind} is vendor or author",
  ],
  "apply.conflict_body": [
    "One account holds one seller store, so it cannot also apply as {role}. The application below is your {kind} application.",
    "{role} is the role being applied for, {kind} the one the account already holds",
  ],
  "apply.documents": ["Documents", "heading over the uploaded documents"],
  "apply.document_uploaded": ["Uploaded", "a document was stored"],
  "apply.document_failed": ["Not uploaded: {error}", "a document was not stored; {error} says why"],
  "apply.documents_retry": "Upload the failed documents again",
  "apply.documents_some_failed":
    "Your application was received, but some documents were not uploaded.",
  "apply.document_invalid": ["{field}: {problem}", "a chosen file was refused; {problem} says why"],
  "apply.document_hint": "PDF, JPEG, PNG or WebP, up to 5 MB",
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
  "apply.manager.title": "Application Manager",
  "apply.manager.subtitle":
    "Every partner application in one place - read in full, documents opened, decided with a recorded reason.",
  "apply.manager.back": ["Control Panel", "link back to the Control Panel"],
  "apply.queue.title_all": "All applications",
  "apply.queue.title_role": [
    "{role} applications",
    "{role} is reseller, vendor, author or affiliate",
  ],
  "apply.queue.kind": ["Kind of application", "label of the filter by role"],
  "apply.queue.kind_all": "Every kind",
  "apply.queue.details": ["Details", "opens the full application"],
  "apply.queue.no_documents": "No documents were uploaded with this application.",
  "apply.queue.history": [
    "Decisions",
    "heading over the list of decisions taken on an application",
  ],
  "apply.queue.suspend": ["Suspend", "suspends an approved account"],
  "apply.queue.reinstate": ["Reinstate", "approves a suspended account again"],
  "apply.queue.suspend_reason": "Reason for suspension (sent to the applicant)",
  "apply.queue.confirm_suspend": "Suspend",
} as const;
