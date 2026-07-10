import type {
  AdminAgentFindingCategory,
  AdminSiteConfigResponse,
  SiteNavigationItemResponse,
  SiteSocialLinkResponse,
  UpdateAdminSiteSettingsRequest,
} from "@adrian-zephyr-notes/contracts";
import { Loader2, Plus, Save, ShieldCheck, Trash2 } from "lucide-react";
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
            <CardTitle>首页 / 导航 / Agent</CardTitle>
            <CardDescription>管理读者侧展示，以及后台 Agent 治理策略。</CardDescription>
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
        <AgentAutomationPolicySection
          policy={settings.adminAgentAutomationPolicy}
          onChange={(adminAgentAutomationPolicy) =>
            onChange({ ...settings, adminAgentAutomationPolicy })
          }
        />
      </CardContent>
    </Card>
  );
}

function AgentAutomationPolicySection({
  onChange,
  policy,
}: {
  onChange: (policy: UpdateAdminSiteSettingsRequest["adminAgentAutomationPolicy"]) => void;
  policy: UpdateAdminSiteSettingsRequest["adminAgentAutomationPolicy"];
}) {
  function patchPolicy(patch: Partial<typeof policy>) {
    onChange({
      ...policy,
      ...patch,
      autoHideEnabled: false,
      mode: "MANUAL_REVIEW",
    });
  }

  function toggleCategory(category: AdminAgentFindingCategory, checked: boolean) {
    const categories = new Set(policy.eligibleCategories);

    if (checked) {
      categories.add(category);
    } else {
      categories.delete(category);
    }

    patchPolicy({
      eligibleCategories: Array.from(categories).filter(isConfigurableAutomationCategory),
    });
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border/70 bg-background/65 p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
          <ShieldCheck aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Agent 候选规则</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            用于标记高置信自动化候选；当前不会自动执行，所有候选仍需管理员确认。
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="自动执行">
          <div className="flex min-h-10 items-center gap-2 rounded-md border border-border/70 bg-muted/35 px-3 text-sm text-muted-foreground">
            <Checkbox aria-label="自动执行未开放" checked={false} disabled />
            <span>未开放，候选仍需管理员确认</span>
          </div>
        </Field>
        <Field label="候选阈值">
          <Input
            max={1}
            min={0.5}
            step={0.01}
            type="number"
            value={policy.confidenceThreshold}
            onChange={(event) => patchPolicy({ confidenceThreshold: Number(event.target.value) })}
          />
        </Field>
      </div>

      <div className="grid gap-2">
        <p className="text-xs font-medium text-muted-foreground">适用分类</p>
        <div className="flex flex-wrap gap-3">
          {configurableAutomationCategories.map((category) => (
            <label key={category} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={policy.eligibleCategories.includes(category)}
                id={`agent-policy-category-${category}`}
                onCheckedChange={(checked) => toggleCategory(category, checked)}
              />
              <span>{formatAutomationCategory(category)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Checkbox
          id="agent-policy-strong-evidence"
          checked={policy.requiresStrongEvidence}
          onCheckedChange={(checked) => patchPolicy({ requiresStrongEvidence: checked })}
        />
        <label htmlFor="agent-policy-strong-evidence">必须命中强证据</label>
      </div>
    </section>
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
    adminAgentAutomationPolicy: config.adminAgentAutomationPolicy,
    home: config.home,
    navigationItems: config.navigationItems,
    socialLinks: config.socialLinks,
  };
}

function normalizeSettingsDraft(
  settings: UpdateAdminSiteSettingsRequest,
): UpdateAdminSiteSettingsRequest {
  const eligibleCategories = normalizeEligiblePolicyCategories(
    settings.adminAgentAutomationPolicy.eligibleCategories,
  );

  return {
    adminAgentAutomationPolicy: {
      ...settings.adminAgentAutomationPolicy,
      autoHideEnabled: false,
      confidenceThreshold: normalizeConfidenceThreshold(
        settings.adminAgentAutomationPolicy.confidenceThreshold,
      ),
      eligibleCategories,
      mode: "MANUAL_REVIEW",
    },
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

const configurableAutomationCategories = [
  "SPAM",
  "ABUSE",
] as const satisfies readonly AdminAgentFindingCategory[];

function isConfigurableAutomationCategory(
  category: AdminAgentFindingCategory,
): category is (typeof configurableAutomationCategories)[number] {
  return configurableAutomationCategories.includes(
    category as (typeof configurableAutomationCategories)[number],
  );
}

function formatAutomationCategory(category: AdminAgentFindingCategory) {
  const labels: Record<AdminAgentFindingCategory, string> = {
    ABUSE: "辱骂攻击",
    HARASSMENT: "骚扰",
    OTHER: "其他",
    SENSITIVE: "敏感内容",
    SPAM: "广告垃圾",
  };

  return labels[category];
}

function normalizeEligiblePolicyCategories(categories: AdminAgentFindingCategory[]) {
  const normalized = categories.filter(isConfigurableAutomationCategory);
  return normalized.length > 0 ? normalized : [...configurableAutomationCategories];
}

function normalizeConfidenceThreshold(value: number) {
  if (!Number.isFinite(value)) {
    return 0.95;
  }

  return Math.min(1, Math.max(0.5, Number(value.toFixed(2))));
}

export { normalizeSettingsDraft, SiteSettingsEditor, toSettingsDraft };
