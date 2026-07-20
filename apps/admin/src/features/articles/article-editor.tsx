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
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import { AdminApiError, uploadAdminArticleImage } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import { getArticleImageFileError } from "./article-image-file";
import { insertArticleImageMarkdown, toArticleImageAltText } from "./article-image-markdown";
import { ArticleImageUploadButton } from "./article-image-upload-button";

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
    return <ArticleEditorLoadingPane />;
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

function ArticleEditorLoadingPane() {
  return (
    <div
      className="grid h-full min-h-[520px] place-items-center bg-background/25 p-4"
      aria-busy="true"
      aria-label="正在读取文章"
    >
      <div className="w-full max-w-3xl rounded-3xl border border-border/70 bg-card/80 p-5 shadow-(--shadow-glass)">
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
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid shrink-0 gap-3 lg:grid-cols-[minmax(0,1fr)_160px_160px]">
        <Field label="标题">
          <Input
            maxLength={160}
            placeholder="文章标题"
            value={values.title}
            onChange={(event) => onChange({ ...values, title: event.target.value })}
          />
        </Field>
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const uploadInFlightRef = useRef(false);
  const valuesRef = useRef(values);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  valuesRef.current = values;

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
    <div className="flex min-h-[420px] min-w-0 flex-1 flex-col gap-1.5 xl:min-h-0">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="article-markdown">
          Markdown 内容
        </label>
        <ArticleImageUploadButton
          isUploading={isUploadingImage}
          onImageSelected={(file) => void uploadImage(file)}
        />
      </div>
      <Textarea
        ref={textareaRef}
        id="article-markdown"
        aria-describedby="article-image-upload-status"
        className={cn(
          "min-h-[420px] flex-1 resize-none overflow-auto font-mono leading-7 xl:min-h-0",
          isDraggingImage && "border-primary bg-primary/5 ring-3 ring-primary/20",
        )}
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
      <div id="article-image-upload-status" className="min-h-5 text-xs" aria-live="polite">
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
    <details className="group shrink-0 rounded-xl border border-border/70 bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-foreground transition-[background-color,box-shadow] duration-150 ease-(--ease-out-ui) outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" />
          <span>发布设置</span>
          <span className="hidden truncate text-xs font-normal text-muted-foreground sm:inline">
            SEO、分类、封面和标签发布前再完善
          </span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform duration-150 ease-(--ease-out-ui) group-open:rotate-180 motion-reduce:transition-none motion-reduce:group-open:rotate-0" />
      </summary>
      <div className="grid gap-3 border-t border-border/70 p-3">
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
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
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
                    "inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-sm",
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
