import type {
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  UpdateAdminSiteAnnouncementRequest,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { useEffect, useState } from "react";
import { Check, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useConfirmationDialog } from "../../components/ui/confirmation-dialog";
import {
  getAdminSiteConfig,
  updateAdminSiteAnnouncement,
  updateAdminSiteSettings,
} from "../../lib/admin-api";
import { SiteAnnouncementsPanel, toAnnouncementDraft } from "./site-announcements-panel";
import {
  normalizeSettingsDraft,
  SiteSettingsEditor,
  toSettingsDraft,
} from "./site-settings-editor";

function SiteConfigManagement() {
  const [activeSection, setActiveSection] = useState<
    "home" | "navigation" | "announcements" | "social"
  >("home");
  const [config, setConfig] = useState<AdminSiteConfigResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<UpdateAdminSiteSettingsRequest | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState<UpdateAdminSiteAnnouncementRequest>(
    {},
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [savingAnnouncementId, setSavingAnnouncementId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { confirm, confirmationDialog } = useConfirmationDialog();

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await getAdminSiteConfig();
      setConfig(response);
      setDraftSettings(toSettingsDraft(response));
    } catch {
      setErrorMessage("站点配置加载失败，请检查服务端或管理员权限配置。");
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadConfig() {
    if (isLoading || isSavingSettings || savingAnnouncementId) return;
    const hasSettingsChanges =
      config &&
      draftSettings &&
      JSON.stringify(draftSettings) !== JSON.stringify(toSettingsDraft(config));
    if (hasSettingsChanges || editingAnnouncementId) {
      const confirmed = await confirm({
        title: "重新读取站点配置",
        description: "重新读取会替换当前未保存的设置和公告修改。可以取消并继续编辑。",
        confirmLabel: "放弃修改并读取",
        variant: "destructive",
      });
      if (!confirmed) return;
    }
    setEditingAnnouncementId(null);
    setAnnouncementDraft({});
    await loadConfig();
  }

  function startEditAnnouncement(announcement: AdminSiteAnnouncementResponse) {
    setEditingAnnouncementId(announcement.id);
    setAnnouncementDraft(toAnnouncementDraft(announcement));
  }

  async function saveAnnouncement(announcement: AdminSiteAnnouncementResponse) {
    setSavingAnnouncementId(announcement.id);
    setErrorMessage(null);

    try {
      const updated = await updateAdminSiteAnnouncement(announcement.id, announcementDraft);
      patchAnnouncement(updated);
      setEditingAnnouncementId(null);
      setAnnouncementDraft({});
    } catch {
      setErrorMessage("公告保存失败，请检查必填内容。");
    } finally {
      setSavingAnnouncementId(null);
    }
  }

  async function toggleAnnouncement(announcement: AdminSiteAnnouncementResponse) {
    const nextAction = announcement.isEnabled ? "停用" : "启用";
    const confirmed = await confirm({
      confirmLabel: `${nextAction}公告`,
      description: announcement.isEnabled
        ? "停用后读者侧将不再展示这条公告。"
        : "启用后读者侧会立即展示这条公告。",
      title: `确认${nextAction}公告`,
      variant: announcement.isEnabled ? "destructive" : "default",
    });

    if (!confirmed) {
      return;
    }

    setSavingAnnouncementId(announcement.id);

    try {
      const updated = await updateAdminSiteAnnouncement(announcement.id, {
        isEnabled: !announcement.isEnabled,
      });
      patchAnnouncement(updated);
    } catch {
      setErrorMessage("公告状态更新失败。");
    } finally {
      setSavingAnnouncementId(null);
    }
  }

  async function saveSettings() {
    if (!draftSettings) {
      return;
    }

    const confirmed = await confirm({
      title: "保存站点配置",
      description: "将首页文案、导航与社交链接的当前修改一起保存。",
      confirmLabel: "保存更改",
    });
    if (!confirmed) return;
    setIsSavingSettings(true);
    setErrorMessage(null);

    try {
      const saved = await updateAdminSiteSettings(normalizeSettingsDraft(draftSettings));
      setConfig(saved);
      setDraftSettings(toSettingsDraft(saved));
    } catch {
      setErrorMessage("站点配置保存失败，请检查必填内容。");
    } finally {
      setIsSavingSettings(false);
    }
  }

  function patchAnnouncement(updated: AdminSiteAnnouncementResponse) {
    setConfig((current) =>
      current
        ? {
            ...current,
            announcements: current.announcements.map((announcement) =>
              announcement.id === updated.id ? updated : announcement,
            ),
          }
        : current,
    );
  }

  const changedSections =
    config && draftSettings
      ? [
          JSON.stringify(config.home) !== JSON.stringify(draftSettings.home),
          JSON.stringify(config.navigationItems) !== JSON.stringify(draftSettings.navigationItems),
          JSON.stringify(config.socialLinks) !== JSON.stringify(draftSettings.socialLinks),
        ].filter(Boolean).length
      : 0;

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border">
        <div role="group" aria-label="配置分区" className="flex flex-wrap gap-6">
          {(
            [
              { key: "home", label: "首页" },
              { key: "navigation", label: "导航" },
              { key: "announcements", label: "公告" },
              { key: "social", label: "链接" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={activeSection === item.key}
              onClick={() => setActiveSection(item.key)}
              className={`border-b-2 px-2 py-4 text-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring ${activeSection === item.key ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2 sm:pb-0">
          <Button
            disabled={isLoading || isSavingSettings || Boolean(savingAnnouncementId)}
            variant="ghost"
            onClick={() => void reloadConfig()}
          >
            <RefreshCw
              className={isLoading ? "animate-spin motion-reduce:animate-none" : undefined}
            />
            {isLoading ? "正在读取" : "重新读取配置"}
          </Button>
          {activeSection !== "announcements" ? (
            <Button
              disabled={!draftSettings || isLoading || isSavingSettings}
              onClick={() => void saveSettings()}
            >
              <Check />
              {isSavingSettings ? "保存中" : "保存更改"}
            </Button>
          ) : null}
        </div>
      </div>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </p>
      ) : null}
      {!config && isLoading ? (
        <p
          role="status"
          className="rounded-xl border border-border/70 bg-card px-6 py-12 text-center text-sm text-muted-foreground"
        >
          正在读取站点配置…
        </p>
      ) : null}
      <fieldset
        id="site-settings"
        disabled={isLoading}
        hidden={activeSection === "announcements"}
        className="min-w-0"
      >
        {draftSettings ? (
          <SiteSettingsEditor
            settings={draftSettings}
            section={activeSection === "announcements" ? "home" : activeSection}
            saving={isSavingSettings}
            onChange={setDraftSettings}
            onSave={() => void saveSettings()}
          />
        ) : null}
      </fieldset>
      <div id="site-announcements" hidden={activeSection !== "announcements"}>
        {config ? (
          <SiteAnnouncementsPanel
            announcements={config.announcements}
            draft={announcementDraft}
            editingAnnouncementId={editingAnnouncementId}
            isLoading={isLoading}
            savingAnnouncementId={savingAnnouncementId}
            onCancelEdit={() => setEditingAnnouncementId(null)}
            onChangeDraft={setAnnouncementDraft}
            onSave={(announcement) => void saveAnnouncement(announcement)}
            onStartEdit={startEditAnnouncement}
            onToggle={(announcement) => void toggleAnnouncement(announcement)}
          />
        ) : null}
      </div>
      {config ? (
        <p className="border-t border-border pt-4 text-xs/6 text-muted-foreground" role="status">
          {changedSections > 0 ? `有 ${changedSections} 个分区未保存更改` : "当前配置已保存"}
        </p>
      ) : null}
      {confirmationDialog}
    </div>
  );
}

export { SiteConfigManagement };
