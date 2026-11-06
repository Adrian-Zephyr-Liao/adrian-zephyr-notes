import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../../audit/domain/admin-operation-log";

type AssistantTurnStatus =
  | "RUNNING"
  | "CANCELLING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED"
  | "INTERRUPTED";
type AssistantActionStatus = "PENDING" | "APPLIED" | "REJECTED";
type AssistantActionDecision = "CONFIRM" | "REJECT";
type AssistantActionReceipt = {
  actionId: string;
  commentId: string;
  previousStatus: "VISIBLE" | "HIDDEN";
  status: "VISIBLE" | "HIDDEN";
  auditLogId: string;
  appliedAt: string;
};
type AssistantAction = {
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
type AssistantTranscript = { version: 1; messages: unknown[] };
type AssistantConversation = { id: string; ownerUserId: string; createdAt: Date; updatedAt: Date };
type AssistantTurn = {
  id: string;
  conversationId: string;
  requestId: string;
  inputHash: string;
  input: string;
  status: AssistantTurnStatus;
  transcript: AssistantTranscript;
  errorCode: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type AssistantTurnIdentity = { ownerUserId: string; conversationId: string; turnId: string };
type PrepareAssistantActionInput = {
  actor: AdminOperationActor & { id: string };
  conversationId: string;
  turnId: string;
  toolCallId: string;
  commentId: string;
  targetStatus: "VISIBLE" | "HIDDEN";
};
type DecideAssistantActionInput = {
  actor: AdminOperationActor & { id: string };
  conversationId: string;
  actionId: string;
  decision: AssistantActionDecision;
  requestContext?: AdminOperationRequestContext;
};
interface AssistantRepository {
  createConversation(ownerUserId: string): Promise<AssistantConversation>;
  getConversation(ownerUserId: string, conversationId: string): Promise<AssistantConversation>;
  listTurns(
    ownerUserId: string,
    conversationId: string,
    options?: { limit?: number; before?: string },
  ): Promise<{ turns: AssistantTurn[]; nextBefore: string | null }>;
  getTurn(ownerUserId: string, conversationId: string, requestId: string): Promise<AssistantTurn>;
  admitTurn(input: {
    ownerUserId: string;
    conversationId: string;
    requestId: string;
    input: string;
    inputHash: string;
  }): Promise<{ created: boolean; turn: AssistantTurn }>;
  saveProgress(
    input: AssistantTurnIdentity & { transcript: AssistantTranscript },
  ): Promise<AssistantTurn>;
  finishTurn(
    input: AssistantTurnIdentity & {
      status: "COMPLETED" | "FAILED" | "INTERRUPTED";
      transcript: AssistantTranscript;
      errorCode?: string;
    },
  ): Promise<AssistantTurn>;
  requestCancellation(
    ownerUserId: string,
    conversationId: string,
    turnId: string,
  ): Promise<AssistantTurn>;
  finishCancellation(
    input: AssistantTurnIdentity & { transcript?: AssistantTranscript },
  ): Promise<AssistantTurn>;
  interruptActiveTurns(): Promise<number>;
  listCommentActions(
    ownerUserId: string,
    conversationId: string,
    turnId?: string,
  ): Promise<AssistantAction[]>;
  prepareCommentAction(input: PrepareAssistantActionInput): Promise<AssistantAction>;
  decideCommentAction(input: DecideAssistantActionInput): Promise<AssistantAction>;
}
class AssistantRepositoryError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "REQUEST_CONFLICT"
      | "CONVERSATION_BUSY"
      | "TURN_INACTIVE"
      | "ACTION_CONFLICT"
      | "RESOURCE_CHANGED",
    message: string,
  ) {
    super(message);
  }
}
const ASSISTANT_REPOSITORY = Symbol("ASSISTANT_REPOSITORY");
export { ASSISTANT_REPOSITORY, AssistantRepositoryError };
export type {
  AssistantRepository,
  AssistantTurnStatus,
  AssistantActionStatus,
  AssistantActionDecision,
  AssistantActionReceipt,
  AssistantAction,
  AssistantConversation,
  AssistantTurn,
  AssistantTranscript,
  AssistantTurnIdentity,
  PrepareAssistantActionInput,
  DecideAssistantActionInput,
};
