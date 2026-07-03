import type {
  AdminSiteConfigResponse,
  SiteNavigationItemResponse,
  SiteSocialLinkResponse,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
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

function SiteSettingsEditor({
  onChange,
  onSave,
  saving,
  settings,
}: {
  onChange: (settings: UpdateAdminSiteSettingsRequest) => void;
  onSave: () => void;
  saving: boolean;
  settings: UpdateAdminSiteSettingsRequest;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle>首页 / 导航 / 社交</CardTitle>
            <CardDescription>这些配置会直接影响读者侧展示。</CardDescription>
          </div>
          <Button disabled={saving} type="button" onClick={onSave}>
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            保存配置
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">首页</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="眉标">
              <Input
                value={settings.home.eyebrow}
                onChange={(event) =>
                  onChange({ ...settings, home: { ...settings.home, eyebrow: event.target.value } })
                }
              />
            </Field>
            <Field label="标题">
              <Input
                value={settings.home.title}
                onChange={(event) =>
                  onChange({ ...settings, home: { ...settings.home, title: event.target.value } })
                }
              />
            </Field>
          </div>
          <Field label="副标题">
            <Textarea
              rows={3}
              value={settings.home.subtitle}
              onChange={(event) =>
                onChange({ ...settings, home: { ...settings.home, subtitle: event.target.value } })
              }
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="主按钮文案">
              <Input
                value={settings.home.primaryActionLabel}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    home: { ...settings.home, primaryActionLabel: event.target.value },
                  })
                }
              />
            </Field>
            <Field label="主按钮链接">
              <Input
                value={settings.home.primaryActionHref}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    home: { ...settings.home, primaryActionHref: event.target.value },
                  })
                }
              />
            </Field>
            <Field label="次按钮文案">
              <Input
                value={settings.home.secondaryActionLabel ?? ""}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    home: { ...settings.home, secondaryActionLabel: event.target.value },
                  })
                }
              />
            </Field>
            <Field label="次按钮链接">
              <Input
                value={settings.home.secondaryActionHref ?? ""}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    home: { ...settings.home, secondaryActionHref: event.target.value },
                  })
                }
              />
            </Field>
          </div>
        </section>
        <EditableLinkList
          items={settings.navigationItems}
          kind="navigation"
          title="导航"
          onChange={(navigationItems) => onChange({ ...settings, navigationItems })}
        />
        <EditableLinkList
          items={settings.socialLinks}
          kind="social"
          title="社交链接"
          onChange={(socialLinks) => onChange({ ...settings, socialLinks })}
        />
      </CardContent>
    </Card>
  );
}

type EditableLinkListProps =
  | {
      items: SiteNavigationItemResponse[];
      kind: "navigation";
      onChange: (items: SiteNavigationItemResponse[]) => void;
      title: string;
    }
  | {
      items: SiteSocialLinkResponse[];
      kind: "social";
      onChange: (items: SiteSocialLinkResponse[]) => void;
      title: string;
    };

type EditableBaseLink = Pick<
  SiteNavigationItemResponse,
  "href" | "id" | "isEnabled" | "isExternal" | "label" | "sortOrder"
>;

function EditableLinkList(props: EditableLinkListProps) {
  return props.kind === "social" ? (
    <EditableSocialLinkList {...props} />
  ) : (
    <EditableNavigationLinkList {...props} />
  );
}

function EditableNavigationLinkList({
  items,
  onChange,
  title,
}: Extract<EditableLinkListProps, { kind: "navigation" }>) {
  function patchItem(index: number, patch: Partial<SiteNavigationItemResponse>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  return (
    <EditableLinkListFrame
      addLabel="添加"
      title={title}
      onAdd={() => onChange([...items, createNavigationItem(items.length)])}
    >
      {items.map((item, index) => (
        <EditableLinkItemFrame
          key={`${item.id}-${index}`}
          item={item}
          onRemove={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
        >
          <BaseLinkFields item={item} onPatch={(patch) => patchItem(index, patch)} />
        </EditableLinkItemFrame>
      ))}
    </EditableLinkListFrame>
  );
}

function EditableSocialLinkList({
  items,
  onChange,
  title,
}: Extract<EditableLinkListProps, { kind: "social" }>) {
  function patchItem(index: number, patch: Partial<SiteSocialLinkResponse>) {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  return (
    <EditableLinkListFrame
      addLabel="添加"
      title={title}
      onAdd={() => onChange([...items, createSocialItem(items.length)])}
    >
      {items.map((item, index) => (
        <EditableLinkItemFrame
          key={`${item.id}-${index}`}
          item={item}
          onRemove={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
        >
          <BaseLinkFields item={item} onPatch={(patch) => patchItem(index, patch)} />
          <Field label="图标">
            <Input
              value={item.icon}
              onChange={(event) => patchItem(index, { icon: event.target.value })}
            />
          </Field>
        </EditableLinkItemFrame>
      ))}
    </EditableLinkListFrame>
  );
}

function EditableLinkListFrame({
  addLabel,
  children,
  onAdd,
  title,
}: {
  addLabel: string;
  children: ReactNode;
  onAdd: () => void;
  title: string;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button size="sm" type="button" variant="outline" onClick={onAdd}>
          <Plus />
          {addLabel}
        </Button>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function EditableLinkItemFrame({
  children,
  item,
  onRemove,
}: {
  children: ReactNode;
  item: EditableBaseLink;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/65 p-3">
      <div className="grid gap-3 md:grid-cols-3">{children}</div>
      <div className="mt-2 flex justify-end">
        <Button
          size="sm"
          type="button"
          variant="destructive"
          onClick={() => {
            const confirmed = window.confirm(
              `移除「${item.label || item.id}」？保存后读者侧不再展示。`,
            );

            if (confirmed) {
              onRemove();
            }
          }}
        >
          <Trash2 />
          移除
        </Button>
      </div>
    </div>
  );
}

function BaseLinkFields<TItem extends EditableBaseLink>({
  item,
  onPatch,
}: {
  item: TItem;
  onPatch: (patch: Partial<TItem>) => void;
}) {
  return (
    <>
      <Field label="ID">
        <Input
          value={item.id}
          onChange={(event) => onPatch({ id: event.target.value } as Partial<TItem>)}
        />
      </Field>
      <Field label="名称">
        <Input
          value={item.label}
          onChange={(event) => onPatch({ label: event.target.value } as Partial<TItem>)}
        />
      </Field>
      <Field label="链接">
        <Input
          value={item.href}
          onChange={(event) => onPatch({ href: event.target.value } as Partial<TItem>)}
        />
      </Field>
      <Field label="排序">
        <Input
          type="number"
          value={item.sortOrder}
          onChange={(event) => onPatch({ sortOrder: Number(event.target.value) } as Partial<TItem>)}
        />
      </Field>
      <div className="flex items-end gap-4 pb-2">
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id={`${item.id}-external`}
            checked={item.isExternal}
            onCheckedChange={(checked) => onPatch({ isExternal: checked } as Partial<TItem>)}
          />
          <label htmlFor={`${item.id}-external`}>外链</label>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Checkbox
            id={`${item.id}-enabled`}
            checked={item.isEnabled}
            onCheckedChange={(checked) => onPatch({ isEnabled: checked } as Partial<TItem>)}
          />
          <label htmlFor={`${item.id}-enabled`}>启用</label>
        </div>
      </div>
    </>
  );
}

function toSettingsDraft(config: AdminSiteConfigResponse): UpdateAdminSiteSettingsRequest {
  return {
    home: config.home,
    navigationItems: config.navigationItems,
    socialLinks: config.socialLinks,
  };
}

function normalizeSettingsDraft(
  settings: UpdateAdminSiteSettingsRequest,
): UpdateAdminSiteSettingsRequest {
  return {
    home: {
      ...settings.home,
      secondaryActionLabel: normalizeNullableText(settings.home.secondaryActionLabel),
      secondaryActionHref: normalizeNullableText(settings.home.secondaryActionHref),
    },
    navigationItems: settings.navigationItems,
    socialLinks: settings.socialLinks,
  };
}

function createNavigationItem(index: number): SiteNavigationItemResponse {
  return {
    id: `navigation-${globalThis.crypto.randomUUID().slice(0, 8)}`,
    label: "",
    href: "/",
    isExternal: false,
    isEnabled: true,
    sortOrder: index * 10 + 10,
  };
}

function createSocialItem(index: number): SiteSocialLinkResponse {
  return {
    id: `social-${globalThis.crypto.randomUUID().slice(0, 8)}`,
    label: "",
    href: "https://",
    icon: "link",
    isExternal: true,
    isEnabled: true,
    sortOrder: index * 10 + 10,
  };
}

function normalizeNullableText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export { normalizeSettingsDraft, SiteSettingsEditor, toSettingsDraft };
