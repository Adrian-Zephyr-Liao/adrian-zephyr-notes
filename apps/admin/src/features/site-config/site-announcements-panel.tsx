import type {
  AdminSiteAnnouncementResponse,
  UpdateAdminSiteAnnouncementRequest,
} from "@adrian-zephyr-notes/contracts";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Field } from "./site-config-field";

type SiteAnnouncementsPanelProps = {
  announcements: AdminSiteAnnouncementResponse[];
  draft: UpdateAdminSiteAnnouncementRequest;
  editingAnnouncementId: string | null;
  isLoading: boolean;
  onCancelEdit: () => void;
  onChangeDraft: (draft: UpdateAdminSiteAnnouncementRequest) => void;
  onRefresh: () => void;
  onSave: (announcement: AdminSiteAnnouncementResponse) => void;
  onStartEdit: (announcement: AdminSiteAnnouncementResponse) => void;
  onToggle: (announcement: AdminSiteAnnouncementResponse) => void;
  savingAnnouncementId: string | null;
};

function SiteAnnouncementsPanel({
  announcements,
  draft,
  editingAnnouncementId,
  isLoading,
  onCancelEdit,
  onChangeDraft,
  onRefresh,
  onSave,
  onStartEdit,
  onToggle,
  savingAnnouncementId,
}: SiteAnnouncementsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>公告</CardTitle>
            <CardDescription>控制读者侧公告轮播内容。</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={onRefresh}>
            <RefreshCw className={isLoading ? "animate-spin" : undefined} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            正在加载站点配置...
          </div>
        ) : null}
        {announcements.map((announcement) => (
          <article
            key={announcement.id}
            className="rounded-xl border border-border/70 bg-background/65 p-4"
          >
            {editingAnnouncementId === announcement.id ? (
              <AnnouncementEditor
                draft={draft}
                saving={savingAnnouncementId === announcement.id}
                onCancel={onCancelEdit}
                onChange={onChangeDraft}
                onSave={() => onSave(announcement)}
              />
            ) : (
              <AnnouncementSummary
                announcement={announcement}
                saving={savingAnnouncementId === announcement.id}
                onStartEdit={() => onStartEdit(announcement)}
                onToggle={() => onToggle(announcement)}
              />
            )}
          </article>
        ))}
      </CardContent>
    </Card>
  );
}

function AnnouncementSummary({
  announcement,
  onStartEdit,
  onToggle,
  saving,
}: {
  announcement: AdminSiteAnnouncementResponse;
  onStartEdit: () => void;
  onToggle: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{announcement.title}</h3>
            <Badge variant={announcement.isEnabled ? "success" : "outline"}>
              {announcement.isEnabled ? "启用" : "停用"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{announcement.key}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" type="button" variant="outline" onClick={onStartEdit}>
            编辑
          </Button>
          <Button
            disabled={saving}
            size="sm"
            type="button"
            variant={announcement.isEnabled ? "destructive" : "default"}
            onClick={onToggle}
          >
            {announcement.isEnabled ? "停用" : "启用"}
          </Button>
        </div>
      </div>
      <div className="rounded-lg bg-muted/45 p-3 text-sm">
        <p>{announcement.status}</p>
        <p className="mt-1 text-muted-foreground">{announcement.output}</p>
      </div>
    </div>
  );
}

function AnnouncementEditor({
  draft,
  onCancel,
  onChange,
  onSave,
  saving,
}: {
  draft: UpdateAdminSiteAnnouncementRequest;
  onCancel: () => void;
  onChange: (draft: UpdateAdminSiteAnnouncementRequest) => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="标题">
          <Input
            value={draft.title ?? ""}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </Field>
        <Field label="排序">
          <Input
            type="number"
            value={draft.sortOrder ?? 0}
            onChange={(event) => onChange({ ...draft, sortOrder: Number(event.target.value) })}
          />
        </Field>
        <Field label="图标">
          <Input
            value={draft.icon ?? ""}
            onChange={(event) => onChange({ ...draft, icon: event.target.value })}
          />
        </Field>
        <Field label="图标样式">
          <Input
            value={draft.iconClassName ?? ""}
            onChange={(event) => onChange({ ...draft, iconClassName: event.target.value })}
          />
        </Field>
        <Field label="流程">
          <Input
            value={draft.process ?? ""}
            onChange={(event) => onChange({ ...draft, process: event.target.value })}
          />
        </Field>
        <Field label="状态">
          <Input
            value={draft.status ?? ""}
            onChange={(event) => onChange({ ...draft, status: event.target.value })}
          />
        </Field>
      </div>
      <Field label="命令">
        <Input
          value={draft.command ?? ""}
          onChange={(event) => onChange({ ...draft, command: event.target.value })}
        />
      </Field>
      <Field label="输出">
        <Textarea
          rows={3}
          value={draft.output ?? ""}
          onChange={(event) => onChange({ ...draft, output: event.target.value })}
        />
      </Field>
      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          id="site-announcement-enabled"
          checked={Boolean(draft.isEnabled)}
          onCheckedChange={(checked) => onChange({ ...draft, isEnabled: checked })}
        />
        <label htmlFor="site-announcement-enabled">启用公告</label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button disabled={saving} type="button" onClick={onSave}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          保存公告
        </Button>
      </div>
    </div>
  );
}

function toAnnouncementDraft(
  announcement: AdminSiteAnnouncementResponse,
): UpdateAdminSiteAnnouncementRequest {
  return {
    title: announcement.title,
    icon: announcement.icon,
    iconClassName: announcement.iconClassName,
    process: announcement.process,
    status: announcement.status,
    command: announcement.command,
    output: announcement.output,
    isEnabled: announcement.isEnabled,
    sortOrder: announcement.sortOrder,
  };
}

export { SiteAnnouncementsPanel, toAnnouncementDraft };
