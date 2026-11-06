import type { AdminOperationLogAction } from "./audit.js";
import type { AdminArticleCommentListItemResponse } from "./comments.js";
import type { PaginationMeta } from "../public/pagination.js";

type AssistantTurnStatus =
  | "RUNNING"
  | "CANCELLING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "INTERRUPTED";
type AssistantActionStatus = "PENDING" | "APPLIED" | "REJECTED";
type AssistantActionDecision = "CONFIRM" | "REJECT";
type AssistantError = { code: string; message: string };
type AssistantMessage = { id: string; role: "user" | "assistant"; content: string };
type AssistantConversationResponse = { id: string; createdAt: string; updatedAt: string };
type AssistantCapabilitiesResponse = {
  enabled: boolean;
  tools: Array<{ name: string; label: string; description: string; readOnly: boolean }>;
};
type AssistantAuditLogsResult = {
  data: Array<{
    id: string;
    actorLogin: string;
    action: AdminOperationLogAction;
    resourceType: string;
    resourceId: string | null;
    summary: string;
    createdAt: string;
  }>;
  pagination: PaginationMeta;
  filters: {
    action: AdminOperationLogAction | "ALL";
    actorLogin: string | null;
    search: string | null;
  };
  queriedAt: string;
};
type AssistantCommentsResult = {
  data: AdminArticleCommentListItemResponse[];
  pagination: PaginationMeta;
  filters: Record<string, string | number | null>;
  queriedAt: string;
};
type AssistantActionReceipt = {
  actionId: string;
  commentId: string;
  previousStatus: "VISIBLE" | "HIDDEN";
  status: "VISIBLE" | "HIDDEN";
  auditLogId: string;
  appliedAt: string;
};
type AssistantActionResponse = {
  id: string;
  conversationId: string;
  turnId: string;
  status: AssistantActionStatus;
  commentId: string;
  commentBody: string;
  authorLogin: string;
  articleTitle: string;
  currentStatus: "VISIBLE" | "HIDDEN";
  targetStatus: "VISIBLE" | "HIDDEN";
  createdAt: string;
  decidedAt: string | null;
  receipt: AssistantActionReceipt | null;
};
type AssistantToolResult =
  | { kind: "audit_logs"; ok: true; data: AssistantAuditLogsResult }
  | { kind: "comments"; ok: true; data: AssistantCommentsResult }
  | { kind: "comment_action"; ok: true; data: AssistantActionResponse }
  | { kind: "audit_logs" | "comments" | "comment_action"; ok: false; error: AssistantError };
type AssistantToolResultResponse = {
  toolCallId: string;
  name: string;
  result: AssistantToolResult;
};
type AssistantTurnResponse = {
  id: string;
  conversationId: string;
  requestId: string;
  input: string;
  status: AssistantTurnStatus;
  messages: AssistantMessage[];
  toolResults: AssistantToolResultResponse[];
  actions: AssistantActionResponse[];
  error: AssistantError | null;
  createdAt: string;
  updatedAt: string;
};
type AssistantHistoryResponse = {
  conversation: AssistantConversationResponse;
  turns: AssistantTurnResponse[];
  nextBefore: string | null;
};
type AssistantActionDecisionRequest = { decision: AssistantActionDecision };

export type {
  AssistantTurnStatus,
  AssistantActionStatus,
  AssistantActionDecision,
  AssistantError,
  AssistantMessage,
  AssistantConversationResponse,
  AssistantCapabilitiesResponse,
  AssistantAuditLogsResult,
  AssistantCommentsResult,
  AssistantActionReceipt,
  AssistantActionResponse,
  AssistantToolResult,
  AssistantToolResultResponse,
  AssistantTurnResponse,
  AssistantHistoryResponse,
  AssistantActionDecisionRequest,
};
