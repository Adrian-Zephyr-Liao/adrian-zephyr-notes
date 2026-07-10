type AdminAgentFindingStatus = "EXECUTED" | "FAILED" | "PENDING" | "REJECTED" | "RESTORED";
type AdminAgentFindingTargetType = "ARTICLE_COMMENT";
type AdminAgentFindingCategory = "ABUSE" | "HARASSMENT" | "OTHER" | "SENSITIVE" | "SPAM";
type AdminAgentFindingSeverity = "HIGH" | "LOW" | "MEDIUM";
type AdminAgentProposedAction = "HIDE_COMMENT" | "NO_ACTION";

type AdminAgentFindingTargetAuthor = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

type AdminAgentFindingTargetArticle = {
  id: string;
  slug: string;
  title: string;
};

type AdminAgentFindingTarget = {
  id: string;
  body: string;
  status: "HIDDEN" | "VISIBLE";
  author: AdminAgentFindingTargetAuthor;
  article: AdminAgentFindingTargetArticle;
  parent: {
    id: string;
    body: string;
    author: AdminAgentFindingTargetAuthor;
  } | null;
  createdAt: Date;
};

type AdminAgentFinding = {
  id: string;
  runId: string;
  targetType: AdminAgentFindingTargetType;
  targetId: string;
  target: AdminAgentFindingTarget | null;
  category: AdminAgentFindingCategory;
  severity: AdminAgentFindingSeverity;
  confidence: number;
  reason: string;
  evidence: string[];
  proposedAction: AdminAgentProposedAction;
  status: AdminAgentFindingStatus;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdminAgentFindingDraft = {
  targetType: AdminAgentFindingTargetType;
  targetId: string;
  category: AdminAgentFindingCategory;
  severity: AdminAgentFindingSeverity;
  confidence: number;
  reason: string;
  evidence: string[];
  proposedAction: AdminAgentProposedAction;
};

export type {
  AdminAgentFinding,
  AdminAgentFindingCategory,
  AdminAgentFindingDraft,
  AdminAgentFindingSeverity,
  AdminAgentFindingStatus,
  AdminAgentFindingTarget,
  AdminAgentFindingTargetArticle,
  AdminAgentFindingTargetAuthor,
  AdminAgentFindingTargetType,
  AdminAgentProposedAction,
};
