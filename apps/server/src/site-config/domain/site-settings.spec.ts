import { describe, expect, it } from "vitest";
import { defaultSiteConfigSettings, normalizeSiteConfigSettings } from "./site-settings";

describe("normalizeSiteConfigSettings", () => {
  it("keeps admin agent automatic hiding disabled in site-level settings", () => {
    expect(
      normalizeSiteConfigSettings({
        ...defaultSiteConfigSettings,
        adminAgentAutomationPolicy: {
          autoHideEnabled: true,
          confidenceThreshold: 0.99,
          eligibleCategories: ["SPAM"],
          mode: "MANUAL_REVIEW",
          requiresStrongEvidence: false,
        },
      }).adminAgentAutomationPolicy,
    ).toEqual({
      autoHideEnabled: false,
      confidenceThreshold: 0.99,
      eligibleCategories: ["SPAM"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: false,
    });
  });
});
