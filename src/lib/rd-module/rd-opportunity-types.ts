export const OPPORTUNITY_TYPES = [
  "SOFTWARE_ON_DEMAND",
  "SAAS_PARTNERSHIP",
  "BUILD_WITH_US",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const TYPE_LABEL: Record<OpportunityType, string> = {
  SOFTWARE_ON_DEMAND: "Software On Demand",
  SAAS_PARTNERSHIP: "SaaS Partnership",
  BUILD_WITH_US: "Build With Us",
};

export const MAIN_PIPELINE = [
  "NEW",
  "UNDER_REVIEW",
  "RESEARCHING",
  "FEASIBILITY",
  "EXPERIMENT",
  "POC",
  "VALIDATED",
  "APPROVED",
] as const;
export const BRANCH_STATUSES = ["DEVELOPMENT_HANDOFF", "PARTNERSHIP", "RD_PROJECT"] as const;
export const OUTCOME_STATUSES = ["REJECTED", "ARCHIVED", "DUPLICATE", "NEEDS_INFORMATION"] as const;
export const OPPORTUNITY_STATUSES = [
  ...MAIN_PIPELINE,
  ...BRANCH_STATUSES,
  ...OUTCOME_STATUSES,
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const EVALUATION_AREAS = [
  "Customer Demand",
  "Market Opportunity",
  "Technical Feasibility",
  "Development Complexity",
  "Revenue Potential",
  "Strategic Fit",
  "Competition",
  "Required Resources",
  "Risk",
  "Partnership Potential",
] as const;

export const EVALUATION_DECISIONS = [
  "Continue Research",
  "Build POC",
  "Approve",
  "Reject",
  "Partnership",
  "Existing Product",
  "Needs More Information",
] as const;

export const PROJECT_KINDS = ["RESEARCH", "POC", "DEVELOPMENT_HANDOFF", "PARTNERSHIP"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const PARTNERSHIP_STAGES = [
  "Initial Review",
  "Technical Review",
  "Business Review",
  "Partnership Discussion",
  "Proposal",
  "Negotiation",
  "Approved",
  "Rejected",
  "Partnership Project",
] as const;

export const PLATFORMS = ["Web", "Mobile", "Desktop", "SaaS", "API", "Other"] as const;
export const SAAS_STAGES = [
  "IDEA",
  "CONCEPT",
  "PROTOTYPE",
  "MVP",
  "LIVE_PRODUCT",
  "EXISTING_BUSINESS",
] as const;
export const SAAS_BRINGS = [
  "IDEA",
  "TECHNOLOGY",
  "DEVELOPMENT",
  "CUSTOMERS",
  "MARKETING",
  "INDUSTRY_EXPERTISE",
  "CAPITAL",
  "DISTRIBUTION",
  "EXISTING_PRODUCT",
] as const;
export const SAAS_NEEDS = [
  "DEVELOPMENT",
  "TECHNOLOGY",
  "AI",
  "INFRASTRUCTURE",
  "MARKETING",
  "DISTRIBUTION",
  "SALES",
  "SUPPORT",
  "PRODUCT_DEVELOPMENT",
  "COMPLETE_PARTNERSHIP",
] as const;
export const IDEA_CATEGORIES = [
  "Business Idea",
  "Technology Idea",
  "AI Idea",
  "Automation Idea",
  "Product Idea",
  "Marketplace Idea",
  "Platform Idea",
  "Other",
] as const;

/** Public-safe status message: never reveals internal notes or staff. */
export function publicStatusMessage(status: string) {
  if (status === "NEW") return "Your request has been received and is waiting for review.";
  if (status === "NEEDS_INFORMATION")
    return "Our team needs more information. We will contact you by email.";
  if (status === "REJECTED")
    return "Thank you for your submission. We are not able to take this request forward right now.";
  if (status === "ARCHIVED" || status === "DUPLICATE") return "This request has been closed.";
  if (["APPROVED", "DEVELOPMENT_HANDOFF", "PARTNERSHIP", "RD_PROJECT"].includes(status))
    return "Good news — your request has moved forward. Our team will be in touch.";
  return "Your request is currently under review by our R&D team.";
}

export function publicStatusLabel(status: string) {
  if (status === "NEW") return "Submitted";
  if (status === "NEEDS_INFORMATION") return "More information needed";
  if (status === "REJECTED") return "Not proceeding";
  if (status === "ARCHIVED" || status === "DUPLICATE") return "Closed";
  if (["APPROVED", "DEVELOPMENT_HANDOFF", "PARTNERSHIP", "RD_PROJECT"].includes(status))
    return "Approved";
  return "Under review";
}

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "of",
  "to",
  "in",
  "on",
  "with",
  "app",
  "system",
  "software",
  "platform",
  "tool",
  "solution",
  "management",
  "need",
  "we",
  "my",
  "our",
  "online",
  "new",
]);

/** Normalised keyword key used to group similar requests into demand clusters. */
export function clusterKeyFor(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ies)$/, "y").replace(/s$/, ""))
    .sort()
    .slice(0, 4)
    .join("-");
}

export interface Opportunity {
  id: string;
  public_request_id: string;
  type: OpportunityType;
  title: string;
  description: string;
  details: Record<string, string | string[] | number | boolean | null>;
  category: string;
  country: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  attachments: Attachment[];
  company: string;
  status: OpportunityStatus;
  priority: Priority;
  source: string;
  assigned_to: string;
  cluster_key: string;
  related_ref: string;
  created_at: string;
  updated_at: string;
}

export interface OpportunityEvent {
  id: string;
  opportunity_id: string;
  kind: string;
  from_value: string;
  to_value: string;
  body: string;
  actor: string;
  created_at: string;
}

export interface Evaluation {
  id: string;
  opportunity_id: string;
  scores: Record<string, number>;
  decision: string;
  notes: string;
  evidence: string;
  research_links: string[];
  decision_reason: string;
  updated_at: string;
}

export interface RdProject {
  id: string;
  opportunity_id: string;
  kind: ProjectKind;
  name: string;
  objective: string;
  research_question: string;
  owner: string;
  team: string[];
  timeline: string;
  status: string;
  stage: string;
  findings: string;
  results: string;
  recommendation: string;
  acceptance_criteria: string;
  technical_notes: string;
  commercial_terms: string;
  pipeline_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export type Attachment = { path: string; name: string; size: number; type: string };
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
