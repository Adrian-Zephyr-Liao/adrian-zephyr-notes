import type {
  AdminSiteConfigResponse,
  SiteNavigationItemResponse,
  SiteSocialLinkResponse,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { useConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { Input } from "../../components/ui/input";
import { ManagementBody } from "../../components/ui/management-surface";
import { Textarea } from "../../components/ui/textarea";
import { Field } from "./site-config-field";
import { SiteConfigPreview } from "./site-config-preview";

function SiteSettingsEditor({
  onChange,
  onSave,
  saving,
  settings,
  section = "home",
}: {
  onChange: (settings: UpdateAdminSiteSettingsRequest) => void;
  onSave: () => void;
  saving: boolean;
  settings: UpdateAdminSiteSettingsRequest;
  section?: "home" | "navigation" | "social";
}) {
  return (
    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(21rem,0.8fr)_minmax(0,1.4fr)] xl:gap-10">
      <ManagementBody className="grid min-w-0 gap-0 space-y-0 p-0 sm:p-0">
        <section className={section === "home" ? "grid gap-5 pb-8" : "hidden"}>
          <div>
            <span className="text-xs font-medium text-primary tabular-nums">01 / 首页</span>
            <h3 className="mt-2 text-base font-semibold">首页内容</h3>
            <p className="mt-2 text-xs/6 text-muted-foreground">
              设置读者进入博客时看到的介绍与入口。
            </p>
          </div>
          <div className="grid min-w-0 gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="眉标">
                <Input
                  value={settings.home.eyebrow}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      home: { ...settings.home, eyebrow: event.target.value },
                    })
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
                  onChange({
                    ...settings,
                    home: { ...settings.home, subtitle: event.target.value },
                  })
                }
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </section>
        {section === "navigation" ? (
          <EditableLinkList
            items={settings.navigationItems}
            kind="navigation"
            title="导航"
            onChange={(navigationItems) => onChange({ ...settings, navigationItems })}
          />
        ) : null}
        {section === "social" ? (
          <EditableLinkList
            items={settings.socialLinks}
            kind="social"
            title="社交链接"
            onChange={(socialLinks) => onChange({ ...settings, socialLinks })}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border py-5">
          <p className="text-sm text-muted-foreground">将首页、导航与社交链接的修改一起保存。</p>
          <Button disabled={saving} type="button" onClick={onSave}>
            {saving ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Save />}
            {saving ? "保存中" : "保存配置"}
          </Button>
        </div>
      </ManagementBody>
      <SiteConfigPreview settings={settings} />
    </div>
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
    <section className="grid gap-6 pb-8">
      <div>
        <span className="text-xs font-medium text-primary tabular-nums">
          {title === "导航" ? "02 / 导航" : "03 / 社交"}
        </span>
        <h3 className="mt-2 text-base font-semibold">{title}</h3>
        <p className="mt-2 text-xs/6 text-muted-foreground">
          {title === "导航"
            ? "管理顶部导航的名称、链接和展示顺序。"
            : "添加读者可以找到你的外部主页。"}
        </p>
        <Button className="mt-4" size="sm" type="button" variant="outline" onClick={onAdd}>
          <Plus />
          {addLabel}
        </Button>
      </div>
      <div className="min-w-0 divide-y divide-border/70">{children}</div>
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
  const { confirm, confirmationDialog } = useConfirmationDialog();

  return (
    <div className="py-5 first:pt-0 last:pb-0">
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          type="button"
          variant="destructive"
          onClick={() => {
            void confirm({
              confirmLabel: "移除链接",
              description: `移除「${item.label || item.id}」后，保存配置时读者侧将不再展示。`,
              title: "确认移除链接",
              variant: "destructive",
            }).then((confirmed) => {
              if (confirmed) onRemove();
            });
          }}
        >
          <Trash2 />
          移除
        </Button>
      </div>
      {confirmationDialog}
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
      <div className="flex flex-wrap items-end gap-5 pb-2">
        <div className="flex items-center gap-2.5 text-sm">
          <Checkbox
            id={`${item.id}-external`}
            checked={item.isExternal}
            onCheckedChange={(checked) => onPatch({ isExternal: checked } as Partial<TItem>)}
          />
          <label htmlFor={`${item.id}-external`}>外链</label>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
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
