import type {
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  UpdateAdminSiteAnnouncementRequest,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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
  const [activeSection, setActiveSection] = useState<"settings" | "announcements">("settings");
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

  return (
    <div className="grid min-w-0 gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div role="group" aria-label="配置分区" className="flex flex-wrap gap-2">
          <Button
            aria-pressed={activeSection === "settings"}
            aria-controls="site-settings"
            variant={activeSection === "settings" ? "secondary" : "ghost"}
            onClick={() => setActiveSection("settings")}
          >
            展示设置
          </Button>
          <Button
            aria-pressed={activeSection === "announcements"}
            aria-controls="site-announcements"
            variant={activeSection === "announcements" ? "secondary" : "ghost"}
            onClick={() => setActiveSection("announcements")}
          >
            公告
          </Button>
        </div>
        <Button
          disabled={isLoading || isSavingSettings || Boolean(savingAnnouncementId)}
          variant="outline"
          onClick={() => void reloadConfig()}
        >
          <RefreshCw
            className={isLoading ? "animate-spin motion-reduce:animate-none" : undefined}
          />
          {isLoading ? "正在读取" : "重新读取配置"}
        </Button>
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
        <p role="status" className="py-10 text-sm text-muted-foreground">
          正在读取站点配置…
        </p>
      ) : null}
      <fieldset
        id="site-settings"
        disabled={isLoading}
        hidden={activeSection !== "settings"}
        className="min-w-0"
      >
        {draftSettings ? (
          <SiteSettingsEditor
            settings={draftSettings}
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
      {confirmationDialog}
    </div>
  );
}

export { SiteConfigManagement };
