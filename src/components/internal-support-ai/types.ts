/**
 * Internal Support AI Manager - Type Definitions
 * Enterprise-grade, AI-first, Zero-friction Support System
 */

export type SupportAISection =
  | 'dashboard'
  | 'auto-detection'
  | 'issue-classification'
  | 'auto-fix-engine'
  | 'smart-clarification'
  | 'escalation-manager'
  | 'resolution-confirmation'
  | 'knowledge-intelligence'
  | 'ai-transparency-log'
  | 'security-privacy';

export type SystemStatus = 'LIVE' | 'DEGRADED' | 'OFFLINE';

export type IssueClassification =
  | 'ui_failure'
  | 'functional_failure'
  | 'performance_lag'
  | 'permission_issue'
  | 'billing_issue'
  | 'demo_issue'
  | 'ai_response_issue'
  | 'unknown_pattern';

export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';

export type IssueStatus = 
  | 'detected'
  | 'analyzing'
  | 'auto_fixing'
  | 'awaiting_input'
  | 'escalated'
  | 'resolved'
  | 'closed';

export interface SupportIssue {
  id: string;
  timestamp: string;
  classification: IssueClassification;
  priority: IssuePriority;
  status: IssueStatus;
  context: IssueContext;
  autoFixAttempted: boolean;
  autoFixSuccess: boolean | null;
  escalatedTo: string | null;
  resolvedAt: string | null;
  userId: string;
  userRole: string;
  slaDeadline: string;
}

export interface IssueContext {
  pageUrl: string;
  action: string;
  errorType: string | null;
  errorMessage: string | null;
  apiEndpoint: string | null;
  apiStatusCode: number | null;
  sessionData: Record<string, unknown>;
  deviceInfo: string;
  networkLatency: number | null;
}

export interface AutoFixAction {
  id: string;
  issueId: string;
  actionType: string;
  description: string;
  executedAt: string;
  success: boolean;
  rollbackAvailable: boolean;
}

export interface EscalationRecord {
  id: string;
  issueId: string;
  escalatedTo: string;
  escalatedAt: string;
  priority: IssuePriority;
  slaStart: string;
  internalNotes: string;
  userVisibleStatus: string;
}

export interface TransparencyLogEntry {
  id: string;
  timestamp: string;
  issueId: string;
  action: string;
  reason: string;
  outcome: string;
  nextStep: string | null;
}

export interface KnowledgeItem {
  id: string;
  pattern: string;
  classification: IssueClassification;
  resolution: string;
  successRate: number;
  usageCount: number;
  lastUsed: string;
}

export interface SupportMetrics {
  activeIssues: number;
  autoFixedToday: number;
  escalatedIssues: number;
  slaAtRisk: number;
  avgResolutionTime: number;
  aiConfidenceScore: number;
  systemTrustIndex: number;
  autoFixSuccessRate: number;
}
