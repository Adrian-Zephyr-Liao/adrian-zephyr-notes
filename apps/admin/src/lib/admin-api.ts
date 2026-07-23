import type {
  AdminArticleCommentListQuery,
  AdminArticleCommentListResponse,
  AdminArticleCommentListItemResponse,
  AdminArticleDetailResponse,
  AdminArticleCategoryListQuery,
  AdminArticleCategoryListResponse,
  AdminArticleCategoryResponse,
  AdminArticleEditorDraftResponse,
  AdminArticleImageUploadResponse,
  AdminArticleListQuery,
  AdminArticleListResponse,
  AdminArticleTaxonomyOptionsResponse,
  AdminArticleTagListQuery,
  AdminArticleTagListResponse,
  AdminArticleTagResponse,
  AdminAgentConversationMessagesResponse,
  AdminAgentHomeResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskListQuery,
  AdminAgentTaskListResponse,
  ControlAdminAgentTaskRequest,
  ControlAdminAgentTaskResponse,
  DecideAdminAgentFindingsRequest,
  DecideAdminAgentFindingsResponse,
  ModerateAdminAgentCommentAnalysisRequest,
  ModerateAdminAgentCommentAnalysisResponse,
  ResumeAdminAgentTaskRequest,
  ResumeAdminAgentTaskResponse,
  StartAdminAgentTaskRequest,
  StartAdminAgentTaskResponse,
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesQuery,
  AdminGuestbookMessagesResponse,
  AdminMeResponse,
  AdminOperationLogListQuery,
  AdminOperationLogListResponse,
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  CreateAdminArticleRequest,
  CreateAdminArticleCategoryRequest,
  CreateAdminArticleTagRequest,
  MergeAdminArticleTagRequest,
  SaveAdminArticleEditorDraftRequest,
  UpdateAdminArticleRequest,
  UpdateAdminArticleCategoryRequest,
  UpdateAdminArticleTagRequest,
  UpdateAdminArticleCommentRequest,
  UpdateAdminGuestbookMessageRequest,
  UpdateAdminSiteAnnouncementRequest,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { AdminApiError, getBackendApiBaseUrl, requestAdminApi, withAdminQuery } from "./admin-http";

function getAdminLoginUrl(returnTo = "/") {
  const url = new URL(`${getBackendApiBaseUrl()}/api/auth/github/start`, window.location.origin);

  url.searchParams.set("target", "admin");
  url.searchParams.set("returnTo", returnTo);

  return url.toString();
}

async function getCurrentAdmin() {
  return requestAdminApi<AdminMeResponse>("/api/admin/auth/me");
}

async function listAdminArticles(query: AdminArticleListQuery) {
  return requestAdminApi<AdminArticleListResponse>(withAdminQuery("/api/admin/articles", query));
}

async function getAdminArticle(id: string) {
  return requestAdminApi<AdminArticleDetailResponse>(`/api/admin/articles/${id}`);
}

async function listAdminArticleTaxonomies() {
  return requestAdminApi<AdminArticleTaxonomyOptionsResponse>("/api/admin/articles/taxonomies");
}

async function listAdminArticleCategories(query: AdminArticleCategoryListQuery = {}) {
  return requestAdminApi<AdminArticleCategoryListResponse>(
    withAdminQuery("/api/admin/article-categories", query),
  );
}

async function createAdminArticleCategory(input: CreateAdminArticleCategoryRequest) {
  return requestAdminApi<AdminArticleCategoryResponse>("/api/admin/article-categories", {
    json: input,
    method: "POST",
  });
}

async function updateAdminArticleCategory(id: string, input: UpdateAdminArticleCategoryRequest) {
  return requestAdminApi<AdminArticleCategoryResponse>(`/api/admin/article-categories/${id}`, {
    json: input,
    method: "PATCH",
  });
}

async function deleteAdminArticleCategory(id: string) {
  await requestAdminApi<void>(`/api/admin/article-categories/${id}`, {
    emptyResponse: true,
    method: "DELETE",
  });
}

async function listAdminArticleTags(query: AdminArticleTagListQuery = {}) {
  return requestAdminApi<AdminArticleTagListResponse>(
    withAdminQuery("/api/admin/article-tags", query),
  );
}
async function createAdminArticleTag(input: CreateAdminArticleTagRequest) {
  return requestAdminApi<AdminArticleTagResponse>("/api/admin/article-tags", {
    json: input,
    method: "POST",
  });
}
async function updateAdminArticleTag(id: string, input: UpdateAdminArticleTagRequest) {
  return requestAdminApi<AdminArticleTagResponse>(`/api/admin/article-tags/${id}`, {
    json: input,
    method: "PATCH",
  });
}
async function deleteAdminArticleTag(id: string) {
  await requestAdminApi<void>(`/api/admin/article-tags/${id}`, {
    emptyResponse: true,
    method: "DELETE",
  });
}
async function mergeAdminArticleTag(id: string, input: MergeAdminArticleTagRequest) {
  return requestAdminApi<AdminArticleTagResponse>(`/api/admin/article-tags/${id}/merge`, {
    json: input,
    method: "POST",
  });
}

async function getCurrentAdminArticleEditorDraft(articleId?: string | null) {
  return requestAdminApi<AdminArticleEditorDraftResponse | null>(
    withAdminQuery("/api/admin/article-drafts/current", { articleId }),
  );
}

async function getAdminAgentHome() {
  return requestAdminApi<AdminAgentHomeResponse>("/api/admin/agent/home");
}

async function listAdminAgentConversationMessages(conversationId: string) {
  return requestAdminApi<AdminAgentConversationMessagesResponse>(
    `/api/admin/agent/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

async function listAdminAgentTasks(query: AdminAgentTaskListQuery = {}) {
  return requestAdminApi<AdminAgentTaskListResponse>(
    withAdminQuery("/api/admin/agent/tasks", query),
  );
}

async function getAdminAgentTask(taskId: string) {
  return requestAdminApi<AdminAgentTaskSummaryResponse>(`/api/admin/agent/tasks/${taskId}`);
}

async function startAdminAgentTask(input: StartAdminAgentTaskRequest, signal?: AbortSignal) {
  return requestAdminApi<StartAdminAgentTaskResponse>("/api/admin/agent/tasks", {
    json: input,
    method: "POST",
    signal,
  });
}

async function controlAdminAgentTask(
  taskId: string,
  input: ControlAdminAgentTaskRequest,
  signal?: AbortSignal,
) {
  return requestAdminApi<ControlAdminAgentTaskResponse>(
    `/api/admin/agent/tasks/${taskId}/control`,
    {
      json: input,
      method: "POST",
      signal,
    },
  );
}

async function decideAdminAgentFindings(input: DecideAdminAgentFindingsRequest) {
  return requestAdminApi<DecideAdminAgentFindingsResponse>("/api/admin/agent/findings/decisions", {
    json: input,
    method: "POST",
  });
}

async function hideAdminAgentCommentAnalysisFindings(
  conversationId: string,
  analysisId: string,
  input: ModerateAdminAgentCommentAnalysisRequest,
) {
  return requestAdminApi<ModerateAdminAgentCommentAnalysisResponse>(
    `/api/admin/agent/conversations/${encodeURIComponent(conversationId)}/comment-analyses/${encodeURIComponent(analysisId)}/hide`,
    {
      json: input,
      method: "POST",
    },
  );
}

async function resumeAdminAgentTask(
  taskId: string,
  input: ResumeAdminAgentTaskRequest,
  signal?: AbortSignal,
) {
  return requestAdminApi<ResumeAdminAgentTaskResponse>(`/api/admin/agent/tasks/${taskId}/resume`, {
    json: input,
    method: "POST",
    signal,
  });
}

async function saveCurrentAdminArticleEditorDraft(input: SaveAdminArticleEditorDraftRequest) {
  return requestAdminApi<AdminArticleEditorDraftResponse>("/api/admin/article-drafts/current", {
    json: input,
    method: "PUT",
  });
}

async function deleteCurrentAdminArticleEditorDraft(articleId?: string | null) {
  await requestAdminApi<void>(withAdminQuery("/api/admin/article-drafts/current", { articleId }), {
    emptyResponse: true,
    method: "DELETE",
  });
}

async function createAdminArticle(input: CreateAdminArticleRequest) {
  return requestAdminApi<AdminArticleDetailResponse>("/api/admin/articles", {
    json: input,
    method: "POST",
  });
}

async function updateAdminArticle(id: string, input: UpdateAdminArticleRequest) {
  return requestAdminApi<AdminArticleDetailResponse>(`/api/admin/articles/${id}`, {
    json: input,
    method: "PATCH",
  });
}

async function deleteAdminArticle(id: string) {
  await requestAdminApi<void>(`/api/admin/articles/${id}`, {
    emptyResponse: true,
    method: "DELETE",
  });
}

async function uploadAdminArticleImage(file: File) {
  const body = new FormData();
  body.append("file", file, file.name);

  return requestAdminApi<AdminArticleImageUploadResponse>("/api/admin/articles/images", {
    body,
    method: "POST",
  });
}

async function listAdminArticleComments(query: AdminArticleCommentListQuery) {
  return requestAdminApi<AdminArticleCommentListResponse>(
    withAdminQuery("/api/admin/comments", query),
  );
}

async function updateAdminArticleComment(id: string, input: UpdateAdminArticleCommentRequest) {
  return requestAdminApi<AdminArticleCommentListItemResponse>(`/api/admin/comments/${id}`, {
    json: input,
    method: "PATCH",
  });
}

async function listAdminGuestbookMessages(query: AdminGuestbookMessagesQuery) {
  return requestAdminApi<AdminGuestbookMessagesResponse>(
    withAdminQuery("/api/admin/guestbook/messages", query),
  );
}

async function updateAdminGuestbookMessage(id: string, input: UpdateAdminGuestbookMessageRequest) {
  return requestAdminApi<AdminGuestbookMessageListItemResponse>(
    `/api/admin/guestbook/messages/${id}`,
    {
      json: input,
      method: "PATCH",
    },
  );
}

async function getAdminSiteConfig() {
  return requestAdminApi<AdminSiteConfigResponse>("/api/admin/site-config");
}

async function listAdminOperationLogs(query: AdminOperationLogListQuery) {
  return requestAdminApi<AdminOperationLogListResponse>(
    withAdminQuery("/api/admin/audit/logs", query),
  );
}

async function updateAdminSiteAnnouncement(id: string, input: UpdateAdminSiteAnnouncementRequest) {
  return requestAdminApi<AdminSiteAnnouncementResponse>(
    `/api/admin/site-config/announcements/${id}`,
    {
      json: input,
      method: "PATCH",
    },
  );
}

async function updateAdminSiteSettings(input: UpdateAdminSiteSettingsRequest) {
  return requestAdminApi<AdminSiteConfigResponse>("/api/admin/site-config/settings", {
    json: input,
    method: "PUT",
  });
}

async function logoutAdmin() {
  await requestAdminApi<void>("/api/auth/logout", {
    emptyResponse: true,
    method: "POST",
  });
}

export {
  AdminApiError,
  controlAdminAgentTask,
  createAdminArticle,
  createAdminArticleCategory,
  createAdminArticleTag,
  decideAdminAgentFindings,
  deleteAdminArticle,
  deleteAdminArticleCategory,
  deleteAdminArticleTag,
  deleteCurrentAdminArticleEditorDraft,
  getAdminAgentHome,
  getAdminAgentTask,
  getAdminArticle,
  getCurrentAdminArticleEditorDraft,
  getAdminLoginUrl,
  getAdminSiteConfig,
  getCurrentAdmin,
  hideAdminAgentCommentAnalysisFindings,
  listAdminAgentTasks,
  listAdminAgentConversationMessages,
  listAdminArticleComments,
  listAdminArticleCategories,
  listAdminArticleTaxonomies,
  listAdminArticleTags,
  listAdminArticles,
  listAdminGuestbookMessages,
  listAdminOperationLogs,
  logoutAdmin,
  mergeAdminArticleTag,
  resumeAdminAgentTask,
  saveCurrentAdminArticleEditorDraft,
  startAdminAgentTask,
  updateAdminArticle,
  uploadAdminArticleImage,
  updateAdminArticleCategory,
  updateAdminArticleTag,
  updateAdminArticleComment,
  updateAdminGuestbookMessage,
  updateAdminSiteAnnouncement,
  updateAdminSiteSettings,
};
