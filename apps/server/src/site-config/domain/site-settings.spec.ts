import { describe, expect, it } from "vitest";
import { defaultSiteConfigSettings, normalizeSiteConfigSettings } from "./site-settings";

describe("normalizeSiteConfigSettings", () => {
  it("normalizes home text and retains navigation and social links", () => {
    const settings = normalizeSiteConfigSettings({
      ...defaultSiteConfigSettings,
      home: {
        ...defaultSiteConfigSettings.home,
        title: "  Site title  ",
        secondaryActionLabel: "  ",
      },
    });
    expect(settings.home.title).toBe("Site title");
    expect(settings.home.secondaryActionLabel).toBeNull();
    expect(settings.navigationItems).toEqual(defaultSiteConfigSettings.navigationItems);
    expect(settings.socialLinks).toEqual(defaultSiteConfigSettings.socialLinks);
  });

  it("rejects a blank home title", () => {
    expect(() =>
      normalizeSiteConfigSettings({
        ...defaultSiteConfigSettings,
        home: { ...defaultSiteConfigSettings.home, title: "  " },
      }),
    ).toThrow("Home title cannot be empty");
  });
});
