export type Idea = {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  feasibility: number;
  author: string;
  votes: number;
  status: string;
  research_links: number;
  created_at: string;
};

export type Prototype = {
  id: string;
  name: string;
  modules: string[];
  progress: number;
  estimated_hours: number;
  completed_hours: number;
  team: string[];
  status: string;
  integrations: string[];
};

export type ImpactAnalysis = {
  id: string;
  feature: string;
  revenue_impact: string;
  effort_level: string;
  technical_risk: string;
  user_demand: number;
  performance_load: number;
  maintenance_cost: string;
  ai_recommendation: string;
  score_revenue: number;
  score_effort: number;
  score_risk: number;
  score_demand: number;
};

export type Trend = {
  id: string;
  title: string;
  source: string;
  impact: string;
  relevance: number;
  status: string;
  competitors: string[];
  opportunity: string;
  detected_at: string;
};

export type MarketGap = {
  id: string;
  gap: string;
  potential: string;
  difficulty: string;
};

export type Feedback = {
  id: string;
  content: string;
  source: string;
  sentiment: string;
  sentiment_score: number;
  category: string;
  votes: number;
  status: string;
  created_at: string;
};

export type Decision = {
  id: string;
  title: string;
  type: string;
  status: string;
  submitted_by: string;
  submitted_at: string;
  ai_score: number;
  votes_approve: number;
  votes_reject: number;
  votes_hold: number;
  estimated_cost: number;
  estimated_time: string;
  priority: string;
};

export type RnDNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  created_at: string;
};

export type Budget = {
  id: string;
  period: string;
  total_budget: number;
  currency: string;
};

export type Transaction = {
  id: string;
  budget_id: string;
  description: string;
  amount: number;
  type: string;
  status: string;
  occurred_on: string;
};

export type Technology = {
  id: string;
  name: string;
  category: string;
  ring: string;
  description: string;
  relevance: number;
};

export type PipelineItem = {
  id: string;
  title: string;
  description: string;
  stage: string;
  progress: number;
  priority: string;
  assignee: string;
  due_date: string | null;
  ai_score: number | null;
};

export type IdeaEvaluation = {
  id: string;
  title: string;
  description: string;
  category: string;
  scores: Record<string, number>;
  ai_analysis: string;
  created_at: string;
};
