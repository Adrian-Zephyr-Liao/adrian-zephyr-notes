import type { SiteConfigResponse } from "@adrian-zephyr-notes/contracts";
import { getBackendApiBaseUrl } from "./backend-api";
import { isApiRequestError, requestJson } from "./api-client";

const emptySiteConfig = {
  announcements: [],
} satisfies SiteConfigResponse;

async function getSiteConfig(): Promise<SiteConfigResponse> {
  try {
    return await requestJson<SiteConfigResponse>(`${getBackendApiBaseUrl()}/api/site-config`, {
      cache: "no-store",
    });
  } catch (error) {
    if (isApiRequestError(error)) {
      return emptySiteConfig;
    }

    if (error instanceof TypeError) {
      return emptySiteConfig;
    }

    throw new Error("Failed to fetch site config.", {
      cause: error,
    });
  }
}

export { getSiteConfig };
