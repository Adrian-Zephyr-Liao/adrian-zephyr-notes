import type { SiteConfigResponse } from "@adrian-zephyr-notes/contracts";
import { getBackendApiBaseUrl } from "./backend-api";
import { isApiRequestError, requestJson } from "./api-client";

const emptySiteConfig = {
  announcements: [],
  home: {
    eyebrow: "Adrian Zephyr Notes",
    title: "记录工程、写作和长期思考",
    subtitle: "把实践里的问题、方案和取舍整理成可以反复阅读的笔记。",
    primaryActionLabel: "阅读文章",
    primaryActionHref: "/posts/5f7448b7",
    secondaryActionLabel: "留言",
    secondaryActionHref: "/guestbook",
  },
  navigationItems: [],
  socialLinks: [],
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
