import type {
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  UpdateAdminSiteAnnouncementRequest,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { useEffect, useState } from "react";
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
  const [config, setConfig] = useState<AdminSiteConfigResponse | null>(null);
  const [draftSettings, setDraftSettings] = useState<UpdateAdminSiteSettingsRequest | null>(null);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [announcementDraft, setAnnouncementDraft] = useState<UpdateAdminSiteAnnouncementRequest>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [savingAnnouncementId, setSavingAnnouncementId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    const confirmed = window.confirm(announcement.isEnabled ? "停用这条公告？" : "启用这条公告？");

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
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {errorMessage ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive xl:col-span-2">
          {errorMessage}
        </div>
      ) : null}
      <SiteAnnouncementsPanel
        announcements={config?.announcements ?? []}
        draft={announcementDraft}
        editingAnnouncementId={editingAnnouncementId}
        isLoading={isLoading}
        savingAnnouncementId={savingAnnouncementId}
        onCancelEdit={() => setEditingAnnouncementId(null)}
        onChangeDraft={setAnnouncementDraft}
        onRefresh={() => void loadConfig()}
        onSave={(announcement) => void saveAnnouncement(announcement)}
        onStartEdit={startEditAnnouncement}
        onToggle={(announcement) => void toggleAnnouncement(announcement)}
      />
      {draftSettings ? (
        <SiteSettingsEditor
          settings={draftSettings}
          saving={isSavingSettings}
          onChange={setDraftSettings}
          onSave={() => void saveSettings()}
        />
      ) : null}
    </div>
  );
}

export { SiteConfigManagement };
