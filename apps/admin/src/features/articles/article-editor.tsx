import { MarkdownPreview } from "@adrian-zephyr-notes/markdown";
import type {
  ArticleOrigin,
  AdminArticleStatus,
  AdminArticleTaxonomyOptionsResponse,
} from "@adrian-zephyr-notes/contracts";
import {
  ChevronDown,
  Columns2,
  Eye,
  Loader2,
  PencilLine,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import type { ClipboardEvent, DragEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { AdminApiError, uploadAdminArticleImage } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import { getArticleImageFileError } from "./article-image-file";
import { insertArticleImageMarkdown, toArticleImageAltText } from "./article-image-markdown";
import { ArticleMarkdownToolbar } from "./article-markdown-toolbar";
import {
  formatArticleMarkdownSelection,
  type ArticleMarkdownFormat,
} from "./article-markdown-formatting";

type ArticleEditorViewMode = "edit" | "preview" | "split";

type ArticleEditorValues = {
  categorySlug: string;
  coverImageUrl: string;
  description: string;
  markdown: string;
  origin: ArticleOrigin;
  sourceAuthor: string;
  sourceName: string;
  sourceUrl: string;
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
    { icon: PencilLine, label: "编写", mode: "edit" },
    { icon: Columns2, label: "分屏", mode: "split" },
    { icon: Eye, label: "预览", mode: "preview" },
  ];

  return (
    <div className="flex gap-3" role="group" aria-label="编辑视图">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={editorMode === option.mode}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center gap-2 border-b-2 border-transparent px-4 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none",
            editorMode === option.mode && "border-primary text-foreground",
          )}
          onClick={() => onModeChange(option.mode)}
        >
          <option.icon className="size-3.5" />
          {option.label}
        </button>
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
    return <ArticleEditorLoadingPane />;
  }

  if (editorMode === "preview") {
    return <ArticlePreviewPane content={values.markdown} />;
  }

  if (editorMode === "split") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto lg:grid lg:grid-cols-2 lg:gap-6 lg:overflow-hidden">
        <div className="shrink-0 overflow-hidden rounded-sm border border-border bg-card lg:min-h-0 lg:overflow-y-auto">
          <ArticleEditorFields
            taxonomyOptions={taxonomyOptions}
            values={values}
            onChange={onChange}
          />
        </div>
        <ArticlePreviewPane
          className="h-auto shrink-0 overflow-visible lg:h-full lg:overflow-y-auto"
          content={values.markdown}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto h-full min-h-0 max-w-5xl overflow-y-auto rounded-sm border border-border bg-card">
      <ArticleEditorFields taxonomyOptions={taxonomyOptions} values={values} onChange={onChange} />
    </div>
  );
}

function ArticleEditorLoadingPane() {
  return (
    <div
      className="grid h-full min-h-[520px] place-items-center bg-background/25 p-4"
      role="status"
      aria-busy="true"
      aria-label="正在读取文章"
    >
      <div className="w-full max-w-3xl rounded-xl border border-border/70 bg-card/80 p-5">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="grid gap-2">
            <div className="h-4 w-32 rounded-full bg-muted/70 motion-safe:animate-pulse motion-reduce:animate-none" />
            <div className="h-3 w-56 rounded-full bg-muted/45 motion-safe:animate-pulse motion-reduce:animate-none" />
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
            正在读取文章
          </span>
        </div>
        <div className="grid gap-3">
          <div className="h-4 w-full rounded-full bg-muted/50 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-10/12 rounded-full bg-muted/50 motion-safe:animate-pulse motion-reduce:animate-none" />
          <div className="h-4 w-8/12 rounded-full bg-muted/50 motion-safe:animate-pulse motion-reduce:animate-none" />
        </div>
      </div>
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
    <div className="flex min-h-0 flex-col lg:min-h-full">
      <div className="grid shrink-0 gap-4 p-4 pb-5 sm:grid-cols-2 sm:px-6 sm:pt-6">
        <label className="grid gap-2 sm:col-span-2">
          <span className="sr-only">标题</span>
          <Input
            className="h-14 rounded-none border-0 border-b border-border bg-transparent px-0 font-display text-2xl font-medium shadow-none focus-visible:ring-0 sm:text-3xl md:text-3xl"
            maxLength={160}
            placeholder="为这篇文章起个标题"
            value={values.title}
            onChange={(event) => onChange({ ...values, title: event.target.value })}
          />
        </label>
        <Field label="文章来源">
          <Select
            value={values.origin}
            onChange={(event) => {
              const origin = event.target.value as ArticleOrigin;
              onChange({
                ...values,
                origin,
                ...(origin === "ORIGINAL"
                  ? { sourceAuthor: "", sourceName: "", sourceUrl: "" }
                  : {}),
              });
            }}
          >
            <option value="ORIGINAL">原创</option>
            <option value="REPOSTED">转载</option>
          </Select>
        </Field>
        <Field label="保存后的状态">
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
      <MarkdownEditorField values={values} onChange={onChange} />
      <PublishSettingsPanel taxonomyOptions={taxonomyOptions} values={values} onChange={onChange} />
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const uploadInFlightRef = useRef(false);
  const valuesRef = useRef(values);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  valuesRef.current = values;

  function applyFormat(format: ArticleMarkdownFormat) {
    const currentValues = valuesRef.current;
    const insertion = formatArticleMarkdownSelection({
      markdown: currentValues.markdown,
      selectionStart: textareaRef.current?.selectionStart ?? currentValues.markdown.length,
      selectionEnd: textareaRef.current?.selectionEnd ?? currentValues.markdown.length,
      format,
    });
    onChange({ ...currentValues, markdown: insertion.markdown });
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
    });
  }

  async function uploadImage(file: File) {
    if (uploadInFlightRef.current) {
      return;
    }

    const validationError = getArticleImageFileError(file);

    if (validationError) {
      setImageUploadError(validationError);
      setImageUploadMessage(null);
      return;
    }

    const selectionStart = textareaRef.current?.selectionStart ?? values.markdown.length;
    const selectionEnd = textareaRef.current?.selectionEnd ?? selectionStart;
    setImageUploadError(null);
    setImageUploadMessage(null);
    uploadInFlightRef.current = true;
    setIsUploadingImage(true);

    try {
      const uploaded = await uploadAdminArticleImage(file);
      const currentValues = valuesRef.current;
      const currentSelectionStart = textareaRef.current?.selectionStart ?? selectionStart;
      const currentSelectionEnd = textareaRef.current?.selectionEnd ?? selectionEnd;
      const insertion = insertArticleImageMarkdown({
        alt: toArticleImageAltText(uploaded.originalName),
        markdown: currentValues.markdown,
        selectionEnd: currentSelectionEnd,
        selectionStart: currentSelectionStart,
        url: uploaded.url,
      });

      onChange({ ...currentValues, markdown: insertion.markdown });
      setImageUploadMessage(`${uploaded.originalName} 已上传`);
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(insertion.selectionStart, insertion.selectionEnd);
      });
    } catch (error) {
      setImageUploadError(
        error instanceof AdminApiError && error.message
          ? error.message
          : "图片上传失败，请检查网络后重试。",
      );
    } finally {
      uploadInFlightRef.current = false;
      setIsUploadingImage(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const imageFile = Array.from(event.clipboardData.files).find((file) =>
      file.type.startsWith("image/"),
    );

    if (imageFile) {
      event.preventDefault();
      void uploadImage(imageFile);
    }
  }

  function handleDrop(event: DragEvent<HTMLTextAreaElement>) {
    const file = Array.from(event.dataTransfer.files)[0];

    if (!file) {
      return;
    }

    event.preventDefault();
    setIsDraggingImage(false);
    void uploadImage(file);
  }

  return (
    <div className="flex min-w-0 flex-col lg:min-h-72 lg:flex-1">
      <label className="sr-only" htmlFor="article-markdown">
        Markdown 内容
      </label>
      <ArticleMarkdownToolbar
        isUploading={isUploadingImage}
        onFormat={applyFormat}
        onImageSelected={(file) => void uploadImage(file)}
      />
      <div className="relative h-[45dvh] min-h-64 lg:h-auto lg:min-h-48 lg:flex-1">
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 overflow-hidden border-r border-border/60 bg-muted/15 py-4 text-right"
        >
          <pre className="pr-2 font-mono text-[11px] leading-7 text-muted-foreground/70">
            {Array.from(
              { length: Math.max(1, values.markdown.split("\n").length) },
              (_, index) => index + 1,
            ).join("\n")}
          </pre>
        </div>
        <Textarea
          ref={textareaRef}
          id="article-markdown"
          aria-describedby="article-image-upload-status"
          className={cn(
            "absolute inset-0 h-full min-h-0 resize-none overflow-auto rounded-none border-0 bg-transparent py-4 pr-4 pl-14 font-mono text-[13px] leading-7 shadow-none focus-visible:ring-0 md:text-[13px]/7",
            isDraggingImage && "border-primary bg-primary/5 ring-3 ring-primary/20",
          )}
          wrap="off"
          onScroll={(event) => {
            if (lineNumbersRef.current)
              lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
          }}
          onKeyDown={(event) => {
            if (
              !event.nativeEvent.isComposing &&
              (event.metaKey || event.ctrlKey) &&
              ["b", "i"].includes(event.key.toLowerCase())
            ) {
              event.preventDefault();
              applyFormat(event.key.toLowerCase() === "b" ? "bold" : "italic");
            }
          }}
          spellCheck={false}
          value={values.markdown}
          onDragEnter={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setIsDraggingImage(true);
            }
          }}
          onDragLeave={() => setIsDraggingImage(false)}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
            }
          }}
          onDrop={handleDrop}
          onPaste={handlePaste}
          onChange={(event) => onChange({ ...values, markdown: event.target.value })}
        />
      </div>
      <div id="article-image-upload-status" className="min-h-5 px-4 text-xs" aria-live="polite">
        {imageUploadError ? (
          <p className="text-destructive" role="alert">
            {imageUploadError}
          </p>
        ) : imageUploadMessage ? (
          <p className="text-muted-foreground">{imageUploadMessage}</p>
        ) : null}
      </div>
    </div>
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
  const [tagQuery, setTagQuery] = useState("");
  const normalizedTagQuery = tagQuery.trim().toLocaleLowerCase("zh-CN");
  const visibleTags = taxonomyOptions.tags.filter(
    (tag) =>
      !normalizedTagQuery ||
      tag.name.toLocaleLowerCase("zh-CN").includes(normalizedTagQuery) ||
      tag.slug.toLocaleLowerCase("zh-CN").includes(normalizedTagQuery),
  );

  return (
    <details className="group shrink-0 border-t border-border bg-background/30">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground transition-[background-color,box-shadow] duration-150 ease-(--ease-out-ui) outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <span>发布设置</span>
          <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">
            SEO、分类、封面和标签发布前再完善
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform duration-150 ease-(--ease-out-ui) group-open:rotate-180 motion-reduce:transition-none motion-reduce:group-open:rotate-0" />
      </summary>
      <div className="grid gap-4 border-t border-border p-4">
        {values.origin === "REPOSTED" ? (
          <div className="grid gap-3 border-b border-border/70 pb-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label="来源名称">
                <Input
                  maxLength={160}
                  placeholder="例如：作者博客、技术社区"
                  value={values.sourceName}
                  onChange={(event) => onChange({ ...values, sourceName: event.target.value })}
                />
              </Field>
              <Field label="原作者（可选）">
                <Input
                  maxLength={160}
                  placeholder="原作者或组织名称"
                  value={values.sourceAuthor}
                  onChange={(event) => onChange({ ...values, sourceAuthor: event.target.value })}
                />
              </Field>
            </div>
            <Field label="原文链接">
              <Input
                inputMode="url"
                maxLength={2048}
                placeholder="https://example.com/original"
                value={values.sourceUrl}
                onChange={(event) => onChange({ ...values, sourceUrl: event.target.value })}
              />
            </Field>
          </div>
        ) : null}
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
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
            <span>标签</span>
            <span>已选 {values.tagSlugs.length} / 5</span>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="搜索标签"
              className="pl-8"
              placeholder="搜索标签名称或 slug"
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleTags.map((tag) => {
              const checked = values.tagSlugs.includes(tag.slug);
              const selectionLimitReached = !checked && values.tagSlugs.length >= 5;

              return (
                <div
                  key={tag.slug}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary/40 motion-reduce:transition-none",
                    checked && "border-primary/40 bg-primary/10 text-primary",
                  )}
                >
                  <Checkbox
                    id={`article-tag-${tag.slug}`}
                    checked={checked}
                    disabled={selectionLimitReached}
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
            ) : visibleTags.length === 0 ? (
              <span className="text-sm text-muted-foreground">没有匹配的标签。</span>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}

function ArticlePreviewPane({ content, className }: { content: string; className?: string }) {
  return (
    <section
      aria-label="文章正文预览"
      className={cn(
        "article-markdown h-full overflow-y-auto rounded-sm bg-background px-5 py-6 sm:p-7",
        className,
      )}
    >
      <div className="mx-auto max-w-[70ch]">
        <div className="mb-7 flex items-center justify-between gap-3 border-b border-border pb-3 font-sans text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Eye className="size-3.5" />
            正文预览
          </span>
          <span>与博客正文保持一致</span>
        </div>
        <MarkdownPreview content={content || "暂无内容"} />
      </div>
    </section>
  );
}

function Field({
  children,
  label,
  className,
}: {
  children: ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("grid gap-2", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export { ArticleViewModeTabs, ArticleWritingSurface };
export type { ArticleEditorValues, ArticleEditorViewMode };
