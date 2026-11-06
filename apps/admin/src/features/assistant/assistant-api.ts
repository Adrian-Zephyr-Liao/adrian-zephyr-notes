import type {
  AssistantActionDecision,
  AssistantActionResponse,
  AssistantCapabilitiesResponse,
  AssistantConversationResponse,
  AssistantHistoryResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import { requestAdminApi, withAdminQuery } from "../../lib/admin-http";

const assistantPath = "/api/admin/assistant";

function getAssistantCapabilities() {
  return requestAdminApi<AssistantCapabilitiesResponse>(`${assistantPath}/capabilities`);
}

function createAssistantConversation() {
  return requestAdminApi<AssistantConversationResponse>(`${assistantPath}/conversations`, {
    method: "POST",
  });
}

function getAssistantHistory(conversationId: string, before?: string) {
  return requestAdminApi<AssistantHistoryResponse>(
    withAdminQuery(conversationPath(conversationId), { before }),
  );
}

function getAssistantTurn(conversationId: string, requestId: string) {
  return requestAdminApi<AssistantTurnResponse>(turnPath(conversationId, requestId));
}

function stopAssistantTurn(conversationId: string, requestId: string) {
  return requestAdminApi<AssistantTurnResponse>(`${turnPath(conversationId, requestId)}/stop`, {
    method: "POST",
  });
}

function decideAssistantAction(
  conversationId: string,
  actionId: string,
  decision: AssistantActionDecision,
) {
  return requestAdminApi<AssistantActionResponse>(
    `${conversationPath(conversationId)}/actions/${encodeURIComponent(actionId)}/decision`,
    { method: "POST", json: { decision } },
  );
}

function conversationPath(conversationId: string) {
  return `${assistantPath}/conversations/${encodeURIComponent(conversationId)}`;
}

function turnPath(conversationId: string, requestId: string) {
  return `${conversationPath(conversationId)}/turns/${encodeURIComponent(requestId)}`;
}

export {
  createAssistantConversation,
  decideAssistantAction,
  getAssistantCapabilities,
  getAssistantHistory,
  getAssistantTurn,
  stopAssistantTurn,
};
