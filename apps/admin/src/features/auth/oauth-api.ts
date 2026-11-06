import type {
  OAuthAuthorizationDecisionRequest,
  OAuthAuthorizationDecisionResponse,
  OAuthConsentResponse,
} from "@adrian-zephyr-notes/contracts";
import { requestAdminApi } from "../../lib/admin-http";

function getOAuthConsent(userCode: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ user_code: userCode });
  return requestAdminApi<OAuthConsentResponse>(`/api/oauth/consent?${query}`, {
    signal,
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
}

function decideOAuthAuthorization(request: OAuthAuthorizationDecisionRequest) {
  return requestAdminApi<OAuthAuthorizationDecisionResponse>("/api/oauth/authorize", {
    method: "POST",
    json: request,
    cache: "no-store",
    referrerPolicy: "strict-origin",
  });
}

export { decideOAuthAuthorization, getOAuthConsent };
