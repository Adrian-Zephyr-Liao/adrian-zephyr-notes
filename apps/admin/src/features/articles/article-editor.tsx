import { MarkdownPreview } from "@adrian-zephyr-notes/markdown";
import type {
  AdminArticleStatus,
  AdminArticleTaxonomyOptionsResponse,
} from "@adrian-zephyr-notes/contracts";
import { ChevronDown, Columns2, Eye, Loader2, PencilLine, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";

type ArticleEditorViewMode = "edit" | "preview" | "split";

type ArticleEditorValues = {
  categorySlug: string;
  coverImageUrl: string;
  description: string;
  markdown: string;
  status: AdminArticleStatus;
  tagSlugs: string[];
  title: string;
};

function ArticleViewModeTabs({
  editorMode,
  onModeChange,
}: {
  editorMode: ArticleEditorViewMode;
  onModeChange: (mode: ArticleEditorViewMode) => void;
}) {
  const options: Array<{ icon: typeof Columns2; label: string; mode: ArticleEditorViewMode }> = [
    { icon: Columns2, label: "分屏", mode: "split" },
    { icon: PencilLine, label: "编写", mode: "edit" },
    { icon: Eye, label: "预览", mode: "preview" },
  ];

  return (
    <div className="flex rounded-lg border border-border bg-background/70 p-1">
      {options.map((option) => (
        <Button
          key={option.mode}
          size="sm"
          type="button"
          variant={editorMode === option.mode ? "default" : "ghost"}
          onClick={() => onModeChange(option.mode)}
        >
          <option.icon />
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function ArticleWritingSurface({
  editorMode,
  isLoading,
  onChange,
  taxonomyOptions,
  values,
}: {
  editorMode: ArticleEditorViewMode;
  isLoading: boolean;
  onChange: (values: ArticleEditorValues) => void;
  taxonomyOptions: AdminArticleTaxonomyOptionsResponse;
  values: ArticleEditorValues;
}) {
  if (isLoading) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在读取文章...
      </div>
    );
  }

  if (editorMode === "preview") {
    return <ArticlePreviewPane content={values.markdown} />;
  }

  if (editorMode === "split") {
    return (
      <div className="grid h-full min-h-0 overflow-y-auto xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] xl:overflow-hidden">
        <div className="min-h-[760px] border-b border-border/70 p-3 sm:p-4 xl:min-h-0 xl:overflow-hidden xl:border-r xl:border-b-0">
          <ArticleEditorFields
            taxonomyOptions={taxonomyOptions}
            values={values}
            onChange={onChange}
          />
        </div>
        <ArticlePreviewPane content={values.markdown} />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden p-3 sm:p-4">
      <ArticleEditorFields taxonomyOptions={taxonomyOptions} values={values} onChange={onChange} />
    </div>
  );
}

function ArticleEditorFields({
  onChange,
  taxonomyOptions,
  values,
}: {
  onChange: (values: ArticleEditorValues) => void;
  taxonomyOptions: AdminArticleTaxonomyOptionsResponse;
  values: ArticleEditorValues;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
        <Field label="标题">
          <Input
            maxLength={160}
            placeholder="文章标题"
            value={values.title}
            onChange={(event) => onChange({ ...values, title: event.target.value })}
          />
        </Field>
        <Field label="状态">
          <Select
            value={values.status}
            onChange={(event) =>
              onChange({ ...values, status: event.target.value as AdminArticleStatus })
            }
          >
            <option value="DRAFT">草稿</option>
            <option value="PUBLISHED">已发布</option>
            <option value="ARCHIVED">已归档</option>
          </Select>
        </Field>
      </div>
      <PublishSettingsPanel taxonomyOptions={taxonomyOptions} values={values} onChange={onChange} />
      <MarkdownEditorField values={values} onChange={onChange} />
    </div>
  );
}

function MarkdownEditorField({
  onChange,
  values,
}: {
  onChange: (values: ArticleEditorValues) => void;
  values: ArticleEditorValues;
}) {
  return (
    <label className="flex min-h-[420px] min-w-0 flex-1 flex-col gap-1.5 xl:min-h-0">
      <span className="text-xs font-medium text-muted-foreground">Markdown 内容</span>
      <Textarea
        className="min-h-[420px] flex-1 resize-none overflow-auto font-mono leading-7 xl:min-h-0"
        spellCheck={false}
        value={values.markdown}
        onChange={(event) => onChange({ ...values, markdown: event.target.value })}
      />
    </label>
  );
}

function PublishSettingsPanel({
  onChange,
  taxonomyOptions,
  values,
}: {
  onChange: (values: ArticleEditorValues) => void;
  taxonomyOptions: AdminArticleTaxonomyOptionsResponse;
  values: ArticleEditorValues;
}) {
  return (
    <details className="group shrink-0 rounded-xl border border-border/70 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-foreground transition outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/45 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <span>发布设置</span>
          <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">
            SEO、分类、封面和标签发布前再完善
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-border/70 p-3">
        <Field label="SEO 描述">
          <Textarea
            maxLength={500}
            placeholder="给读者和搜索引擎看的短描述"
            rows={3}
            value={values.description}
            onChange={(event) => onChange({ ...values, description: event.target.value })}
          />
        </Field>
        <div className="grid gap-3 lg:grid-cols-2">
          <Field label="分类">
            <Select
              value={values.categorySlug}
              onChange={(event) => onChange({ ...values, categorySlug: event.target.value })}
            >
              <option value="">未分类</option>
              {taxonomyOptions.categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="封面 URL">
            <Input
              placeholder="https://..."
              value={values.coverImageUrl}
              onChange={(event) => onChange({ ...values, coverImageUrl: event.target.value })}
            />
          </Field>
        </div>
        <Field label="标签">
          <div className="flex flex-wrap gap-2">
            {taxonomyOptions.tags.map((tag) => {
              const checked = values.tagSlugs.includes(tag.slug);

              return (
                <div
                  key={tag.slug}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-sm",
                    checked && "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  <Checkbox
                    id={`article-tag-${tag.slug}`}
                    checked={checked}
                    onCheckedChange={(nextChecked) =>
                      onChange({
                        ...values,
                        tagSlugs: nextChecked
                          ? [...values.tagSlugs, tag.slug]
                          : values.tagSlugs.filter((slug) => slug !== tag.slug),
                      })
                    }
                  />
                  <label className="cursor-pointer" htmlFor={`article-tag-${tag.slug}`}>
                    {tag.name}
                  </label>
                </div>
              );
            })}
            {taxonomyOptions.tags.length === 0 ? (
              <span className="text-sm text-muted-foreground">暂无标签。</span>
            ) : null}
          </div>
        </Field>
      </div>
    </details>
  );
}

function ArticlePreviewPane({ content }: { content: string }) {
  return (
    <div className="h-full overflow-y-auto bg-background/55 p-5 sm:p-8">
      <MarkdownPreview content={content || "暂无内容"} />
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export { ArticleViewModeTabs, ArticleWritingSurface };
export type { ArticleEditorValues, ArticleEditorViewMode };
