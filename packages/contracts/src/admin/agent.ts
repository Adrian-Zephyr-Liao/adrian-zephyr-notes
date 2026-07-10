import type { AdminOperationLogAction } from "./audit.js";
import type { PaginatedResponse } from "../public/pagination.js";

type AdminAgentFindingStatus = "EXECUTED" | "FAILED" | "PENDING" | "REJECTED" | "RESTORED";

type AdminAgentFindingCategory = "ABUSE" | "HARASSMENT" | "OTHER" | "SENSITIVE" | "SPAM";
type AdminAgentFindingSeverity = "HIGH" | "LOW" | "MEDIUM";
type AdminAgentFindingTargetType = "ARTICLE_COMMENT";
type AdminAgentProposedAction = "HIDE_COMMENT" | "NO_ACTION";
type AdminAgentAutomationAction = "AUTO_HIDE_COMMENT";
type AdminAgentFindingDecision = "EXECUTE_PROPOSED_ACTION" | "REJECT" | "RESTORE_COMMENT";
type AdminAgentCapabilityId = "articles" | "audit" | "comments" | "guestbook" | "site";
type AdminAgentCapabilityStatus = "AVAILABLE" | "PLANNED";
type AdminAgentTaskStatus =
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED"
  | "PENDING"
  | "RUNNING"
  | "WAITING_FOR_APPROVAL";
type AdminAgentTaskName =
  | "article_assistance"
  | "audit_review"
  | "comment_moderation_analysis"
  | "multi_task_orchestration"
  | "site_config_review";
type AdminAgentTaskAvailability = "AVAILABLE" | "PLANNED";
type AdminAgentTaskControlAction = "cancel" | "branch" | "refresh" | "retry";
type AdminAgentTaskRelation = "branch" | "child" | "retry";

type AdminAgentTaskControlCatalogItem = {
  action: AdminAgentTaskControlAction;
  title: string;
  description: string;
  availability: AdminAgentTaskAvailability;
  allowedStatuses: readonly AdminAgentTaskStatus[];
  requiresPausedTask: boolean;
};

type AdminAgentTaskCatalogItem = {
  taskName: AdminAgentTaskName;
  capabilityId: AdminAgentCapabilityId | null;
  title: string;
  description: string;
  availability: AdminAgentTaskAvailability;
  controls: readonly AdminAgentTaskControlCatalogItem[];
  supportsStart: boolean;
  supportsHumanApproval: boolean;
  requiresApprovalForWrites: boolean;
};

type AdminAgentFindingTargetAuthorResponse = {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
  profileUrl: string;
};

type AdminAgentFindingTargetArticleResponse = {
  id: string;
  slug: string;
  title: string;
};

type AdminAgentFindingTargetResponse = {
  id: string;
  body: string;
  status: "HIDDEN" | "VISIBLE";
  author: AdminAgentFindingTargetAuthorResponse;
  article: AdminAgentFindingTargetArticleResponse;
  parent: {
    id: string;
    body: string;
    author: AdminAgentFindingTargetAuthorResponse;
  } | null;
  createdAt: string;
};

type AdminAgentFindingResponse = {
  id: string;
  taskId: string;
  targetType: AdminAgentFindingTargetType;
  targetId: string;
  target: AdminAgentFindingTargetResponse | null;
  category: AdminAgentFindingCategory;
  severity: AdminAgentFindingSeverity;
  confidence: number;
  reason: string;
  evidence: string[];
  proposedAction: AdminAgentProposedAction;
  status: AdminAgentFindingStatus;
  automationEligibility: AdminAgentAutomationEligibilityResponse | null;
  createdAt: string;
};

type AdminAgentRecentActionResponse = {
  id: string;
  actorLogin: string;
  action: AdminOperationLogAction;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  createdAt: string;
};

type AdminAgentAutomationPolicyMode = "MANUAL_REVIEW";

type AdminAgentAutomationPolicyResponse = {
  mode: AdminAgentAutomationPolicyMode;
  autoHideEnabled: boolean;
  eligibleCategories: AdminAgentFindingCategory[];
  confidenceThreshold: number;
  requiresStrongEvidence: boolean;
};

type AdminAgentAutomationEligibilityResponse =
  | {
      action: AdminAgentAutomationAction;
      eligible: true;
    }
  | {
      eligible: false;
      reason: string;
    };

type AdminAgentCapabilityResponse = {
  id: AdminAgentCapabilityId;
  title: string;
  description: string;
  status: AdminAgentCapabilityStatus;
  supportsChat: boolean;
  requiresApprovalForWrites: boolean;
};

type AdminAgentHomeResponse = {
  todayCommentCount: number;
  todayVisibleCommentCount: number;
  todayHiddenCommentCount: number;
  pendingFindingCount: number;
  automationCandidateCount: number;
  executedActionCount: number;
  automationPolicy: AdminAgentAutomationPolicyResponse;
  capabilities: AdminAgentCapabilityResponse[];
  tasks: AdminAgentTaskCatalogItem[];
  assistantBrief: string;
  lastUpdatedAt: string;
  findings: AdminAgentFindingResponse[];
  recentActions: AdminAgentRecentActionResponse[];
};

type AdminAgentTaskSummaryResponse = {
  id: string;
  taskName: AdminAgentTaskName;
  parentTaskId: string | null;
  relation: AdminAgentTaskRelation | null;
  status: AdminAgentTaskStatus;
  summary: string | null;
  errorMessage: string | null;
  latestEvent: AdminAgentTaskTimelineEventResponse | null;
  createdAt: string;
  updatedAt: string;
};

type AdminAgentTaskListQuery = {
  page?: number;
  pageSize?: number;
  parentTaskId?: string;
  relation?: AdminAgentTaskRelation | "ALL";
  rootOnly?: boolean;
  status?: AdminAgentTaskStatus | "ALL";
  taskName?: AdminAgentTaskName | "ALL";
};

type AdminAgentTaskListResponse = PaginatedResponse<AdminAgentTaskSummaryResponse>;

type StartAdminAgentTaskRequest = {
  input?: Record<string, unknown> | null;
  taskName: AdminAgentTaskName;
};

type AdminAgentTaskApprovalOptionResponse = {
  id: string;
  label: string;
  description: string;
  resume: Record<string, unknown>;
};

type AdminAgentTaskApprovalSubject =
  | "ARTICLE"
  | "ARTICLE_COMMENT"
  | "AUDIT_LOG"
  | "MULTI_TASK"
  | "SITE_CONFIG";

type AdminAgentGenericApprovalInterruptionResponse = {
  kind: "ADMIN_AGENT_APPROVAL";
  action: string;
  approvalId: string;
  options: AdminAgentTaskApprovalOptionResponse[];
  payload: Record<string, unknown>;
  question: string;
  subject: AdminAgentTaskApprovalSubject;
  summary: string;
};

type AdminAgentCommentModerationApprovalInterruptionResponse = Omit<
  AdminAgentGenericApprovalInterruptionResponse,
  "action" | "kind" | "payload" | "subject"
> & {
  kind: "COMMENT_MODERATION_APPROVAL";
  action: "HIDE_COMMENT";
  findingIds: string[];
  payload: {
    findingIds: string[];
    scope: "recentVisibleFallback" | "today";
  };
  scope: "recentVisibleFallback" | "today";
  subject: "ARTICLE_COMMENT";
};

type AdminAgentTaskApprovalInterruptionResponse =
  | AdminAgentCommentModerationApprovalInterruptionResponse
  | AdminAgentGenericApprovalInterruptionResponse;

type AdminAgentActionExecutionResultResponse = {
  appliedCount: number;
  failedCount: number;
  results: AdminAgentActionExecutionResultItemResponse[];
};

type AdminAgentActionExecutionResultItemResponse =
  | {
      resourceId: string;
      status: "APPLIED";
      summary?: string;
    }
  | {
      error: {
        code: string;
        message: string;
      };
      resourceId: string;
      status: "FAILED";
    };

type AdminAgentTaskOutputResponse = Record<string, unknown> & {
  actionResult?: AdminAgentActionExecutionResultResponse | null;
};

type ResumeAdminAgentTaskRequest = {
  resume: Record<string, unknown>;
};

type ControlAdminAgentTaskRequest = {
  action: AdminAgentTaskControlAction;
};

type AdminAgentTaskTimelineEventStatus =
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED"
  | "IN_PROGRESS"
  | "PENDING"
  | "WAITING_FOR_APPROVAL";

type AdminAgentTaskTimelineEventResponse = {
  createdAt: string;
  description: string | null;
  id: string;
  status: AdminAgentTaskTimelineEventStatus;
  title: string;
};

type AdminAgentTaskResponse = {
  events: AdminAgentTaskTimelineEventResponse[];
  interruption: AdminAgentTaskApprovalInterruptionResponse | null;
  output: AdminAgentTaskOutputResponse | null;
  task: AdminAgentTaskSummaryResponse;
  summary: string;
};

type ResumeAdminAgentTaskResponse = AdminAgentTaskResponse;

type StartAdminAgentTaskResponse = ResumeAdminAgentTaskResponse;

type ControlAdminAgentTaskResponse = ResumeAdminAgentTaskResponse;

type AdminAgentChatMessageRole = "assistant" | "user";

type AdminAgentChatMessage = {
  role: AdminAgentChatMessageRole;
  content: string;
};

type AdminAgentConversationMessageResponse = AdminAgentChatMessage & {
  id: string;
  createdAt: string;
};

type AdminAgentConversationMessagesResponse = {
  data: AdminAgentConversationMessageResponse[];
};

type AdminAgentContextEntry = {
  id: string;
  title: string;
  description: string;
  value: string;
};

type AdminAgentAssistantMessage = AdminAgentChatMessage & {
  role: "assistant";
};

type AdminAgentInteractionEvent =
  | {
      id: string;
      type: "textMessage";
      message: AdminAgentAssistantMessage;
      createdAt: string;
    }
  | {
      id: string;
      type: "textDelta";
      messageId: string;
      delta: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "toolCallStart";
      toolCallId: string;
      toolCallName: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "toolCallArgsDelta";
      toolCallId: string;
      delta: string;
      createdAt: string;
    }
  | {
      id: string;
      type: "toolCallEnd";
      toolCallId: string;
      createdAt: string;
    };

type DecideAdminAgentFindingsRequest = {
  decisions: {
    decision: AdminAgentFindingDecision;
    findingId: string;
  }[];
};

type AdminAgentFindingDecisionResultResponse =
  | {
      decision: AdminAgentFindingDecision;
      finding: AdminAgentFindingResponse;
      findingId: string;
      status: "APPLIED";
    }
  | {
      decision: AdminAgentFindingDecision;
      error: {
        code: string;
        message: string;
      };
      findingId: string;
      status: "FAILED";
    };

type DecideAdminAgentFindingsResponse = {
  results: AdminAgentFindingDecisionResultResponse[];
};

export type {
  AdminAgentAssistantMessage,
  AdminAgentActionExecutionResultItemResponse,
  AdminAgentActionExecutionResultResponse,
  AdminAgentAutomationAction,
  AdminAgentAutomationEligibilityResponse,
  AdminAgentAutomationPolicyMode,
  AdminAgentAutomationPolicyResponse,
  AdminAgentCapabilityId,
  AdminAgentCapabilityResponse,
  AdminAgentCapabilityStatus,
  AdminAgentChatMessage,
  AdminAgentChatMessageRole,
  AdminAgentConversationMessageResponse,
  AdminAgentConversationMessagesResponse,
  AdminAgentContextEntry,
  AdminAgentFindingCategory,
  AdminAgentFindingDecision,
  AdminAgentFindingDecisionResultResponse,
  AdminAgentFindingResponse,
  AdminAgentFindingSeverity,
  AdminAgentFindingStatus,
  AdminAgentFindingTargetArticleResponse,
  AdminAgentFindingTargetAuthorResponse,
  AdminAgentFindingTargetResponse,
  AdminAgentFindingTargetType,
  AdminAgentHomeResponse,
  AdminAgentInteractionEvent,
  AdminAgentProposedAction,
  AdminAgentRecentActionResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskStatus,
  AdminAgentCommentModerationApprovalInterruptionResponse,
  AdminAgentGenericApprovalInterruptionResponse,
  AdminAgentTaskApprovalInterruptionResponse,
  AdminAgentTaskApprovalOptionResponse,
  AdminAgentTaskAvailability,
  AdminAgentTaskControlAction,
  AdminAgentTaskControlCatalogItem,
  AdminAgentTaskCatalogItem,
  AdminAgentTaskListQuery,
  AdminAgentTaskListResponse,
  AdminAgentTaskName,
  AdminAgentTaskRelation,
  AdminAgentTaskTimelineEventResponse,
  AdminAgentTaskTimelineEventStatus,
  AdminAgentTaskOutputResponse,
  ControlAdminAgentTaskRequest,
  ControlAdminAgentTaskResponse,
  DecideAdminAgentFindingsRequest,
  DecideAdminAgentFindingsResponse,
  ResumeAdminAgentTaskRequest,
  ResumeAdminAgentTaskResponse,
  StartAdminAgentTaskRequest,
  StartAdminAgentTaskResponse,
};
