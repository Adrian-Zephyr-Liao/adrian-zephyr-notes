import type {
  AdminArticleCommentListQuery,
  AdminArticleCommentListResponse,
  AdminArticleCommentListItemResponse,
  AdminArticleDetailResponse,
  AdminArticleListQuery,
  AdminArticleListResponse,
  AdminArticleTaxonomyOptionsResponse,
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesQuery,
  AdminGuestbookMessagesResponse,
  AdminMeResponse,
  AdminOperationLogListQuery,
  AdminOperationLogListResponse,
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  CreateAdminArticleRequest,
  UpdateAdminArticleRequest,
  UpdateAdminArticleCommentRequest,
  UpdateAdminGuestbookMessageRequest,
  UpdateAdminSiteAnnouncementRequest,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { AdminApiError, getBackendApiBaseUrl, requestAdminApi, withAdminQuery } from "./admin-http";

function getAdminLoginUrl(returnTo = "/") {
  const url = new URL(`${getBackendApiBaseUrl()}/api/auth/github/start`);

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
  createAdminArticle,
  deleteAdminArticle,
  getAdminArticle,
  getAdminLoginUrl,
  getAdminSiteConfig,
  getCurrentAdmin,
  listAdminArticleComments,
  listAdminArticleTaxonomies,
  listAdminArticles,
  listAdminGuestbookMessages,
  listAdminOperationLogs,
  logoutAdmin,
  updateAdminArticle,
  updateAdminArticleComment,
  updateAdminGuestbookMessage,
  updateAdminSiteAnnouncement,
  updateAdminSiteSettings,
};
