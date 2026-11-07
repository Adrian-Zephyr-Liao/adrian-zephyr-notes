import type { AdminArticleTagResponse } from "@adrian-zephyr-notes/contracts";
import { Tag, Combine, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArticleArchiveHeading, ArticleArchiveLayout } from "./article-archive-layout";
import { Button } from "../../components/ui/button";
import { useConfirmationDialog } from "../../components/ui/confirmation-dialog";
import { Input } from "../../components/ui/input";
import {
  ManagementBody,
  ManagementEmpty,
  ManagementList,
  ManagementLoading,
  ManagementPagination,
  ManagementSurface,
  ManagementToolbar,
} from "../../components/ui/management-surface";
import { Select } from "../../components/ui/select";
import {
  AdminApiError,
  createAdminArticleTag,
  deleteAdminArticleTag,
  listAdminArticleTags,
  mergeAdminArticleTag,
  updateAdminArticleTag,
} from "../../lib/admin-api";

const emptyDraft = { name: "", slug: "" };
const PAGE_SIZE = 20;

function ArticleTagManagement() {
  const [tags, setTags] = useState<AdminArticleTagResponse[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<AdminArticleTagResponse | null>(null);
  const [targetTagId, setTargetTagId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalItems: 0, totalPages: 0 });
  const { confirm, confirmationDialog } = useConfirmationDialog();

  const loadTags = useCallback(async (page = 1, q?: string) => {
    setIsLoading(true);
    setReadFailed(false);
    setMessage(null);
    try {
      const response = await listAdminArticleTags({ page, pageSize: PAGE_SIZE, q });
      setTags(response.data);
      setPagination({
        page: response.pagination.page,
        totalItems: response.pagination.totalItems,
        totalPages: response.pagination.totalPages,
      });
    } catch {
      setReadFailed(true);
      setMessage("标签列表加载失败，请检查服务端状态。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  function openForm() {
    returnTarget.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFormOpen(true);
    requestAnimationFrame(() => nameInput.current?.focus());
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
    requestAnimationFrame(() => {
      const target = returnTarget.current;
      if (target?.isConnected) target.focus();
      else newButton.current?.focus();
    });
  }

  async function save() {
    if (!draft.name.trim() || !draft.slug.trim()) {
      setMessage("标签名称和 slug 不能为空。");
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      if (editingId) await updateAdminArticleTag(editingId, draft);
      else await createAdminArticleTag(draft);
      setDraft(emptyDraft);
      setEditingId(null);
      closeForm();
      await loadTags(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(tag: AdminArticleTagResponse) {
    const confirmed = await confirm({
      confirmLabel: "删除标签",
      description: `标签「${tag.name}」将被永久删除。`,
      title: "确认删除标签",
      variant: "destructive",
    });

    if (!confirmed) return;
    try {
      await deleteAdminArticleTag(tag.id);
      await loadTags(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function merge() {
    if (!mergeSource || !targetTagId) {
      setMessage("请选择要合并到的目标标签。");
      return;
    }
    const target = tags.find((tag) => tag.id === targetTagId);
    if (!target) return;

    const confirmed = await confirm({
      confirmLabel: "合并标签",
      description: `「${mergeSource.name}」的文章引用将迁移到「${target.name}」，源标签随后会被删除。`,
      title: "确认合并标签",
      variant: "destructive",
    });

    if (!confirmed) return;
    setIsSaving(true);
    setMessage(null);
    try {
      await mergeAdminArticleTag(mergeSource.id, { targetTagId });
      setMergeSource(null);
      setTargetTagId("");
      await loadTags(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <ArticleArchiveLayout page="tags">
      <ArticleArchiveHeading
        action={
          <Button
            ref={newButton}
            onClick={() => {
              setEditingId(null);
              setDraft(emptyDraft);
              openForm();
            }}
          >
            <Plus />
            新建标签
          </Button>
        }
        title="标签索引"
        subtitle="CROSS REFERENCES"
        meta={
          <span className="font-display text-sm text-muted-foreground tabular-nums">
            {isLoading || readFailed ? "—" : pagination.totalItems} 个
          </span>
        }
      />
      <ManagementSurface className="border-0 bg-transparent shadow-none">
        <ManagementBody className="grid gap-4">
          {message ? (
            <p
              className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {message}
            </p>
          ) : null}
          {formOpen ? (
            <div
              className="grid gap-5 border-y border-primary/30 bg-card/65 p-5 sm:p-6"
              role="group"
              aria-label={editingId ? "编辑标签" : "新建标签"}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                  <span>标签名称</span>
                  <Input
                    ref={nameInput}
                    maxLength={80}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                  <span>标签 slug</span>
                  <Input
                    maxLength={80}
                    placeholder="tag-slug"
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, slug: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <Button disabled={isSaving} variant="outline" onClick={closeForm}>
                  取消
                </Button>
                <Button disabled={isSaving} onClick={() => void save()}>
                  {isSaving ? <Loader2 className="animate-spin" /> : null}
                  保存标签
                </Button>
              </div>
            </div>
          ) : null}
          {mergeSource ? (
            <div className="grid gap-4 border-y border-primary/30 bg-primary/5 p-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div>
                <p className="text-xs text-muted-foreground">源标签</p>
                <p className="font-medium">
                  {mergeSource.name} · {mergeSource.articleCount} 篇文章
                </p>
              </div>
              <label className="grid gap-1">
                <span className="text-xs text-muted-foreground">目标标签</span>
                <Select
                  value={targetTagId}
                  onChange={(event) => setTargetTagId(event.target.value)}
                >
                  <option value="">请选择</option>
                  {tags
                    .filter((tag) => tag.id !== mergeSource.id)
                    .map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name} ({tag.articleCount})
                      </option>
                    ))}
                </Select>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMergeSource(null);
                    setTargetTagId("");
                  }}
                >
                  取消
                </Button>
                <Button disabled={isSaving || !targetTagId} onClick={() => void merge()}>
                  <Combine />
                  确认合并
                </Button>
              </div>
            </div>
          ) : null}
          <ManagementToolbar className="grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索标签"
                className="pl-9"
                placeholder="搜索名称或 slug"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadTags(1, searchText.trim() || undefined);
                }}
              />
            </div>
            <Button
              aria-label="刷新标签"
              size="icon"
              variant="outline"
              onClick={() => void loadTags(pagination.page, searchText.trim() || undefined)}
            >
              <RefreshCw className={isLoading ? "animate-spin" : undefined} />
            </Button>
          </ManagementToolbar>
          {readFailed ? null : isLoading ? (
            <ManagementLoading label="正在加载标签..." />
          ) : tags.length === 0 ? (
            <ManagementEmpty label="暂无文章标签。" />
          ) : (
            <ManagementList>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="grid gap-4 py-5 transition-colors hover:bg-muted/25 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center text-primary">
                      <Tag className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-display text-xl font-medium">{tag.name}</p>
                      <p className="mt-1 font-mono text-[11px] wrap-break-word text-muted-foreground">
                        {tag.slug}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {tag.articleCount} 篇文章
                  </span>
                  <div className="flex justify-end gap-1">
                    <Button
                      aria-label={`编辑${tag.name}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        openForm();
                        setEditingId(tag.id);
                        setDraft({ name: tag.name, slug: tag.slug });
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      aria-label={`合并${tag.name}`}
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setMergeSource(tag);
                        setTargetTagId("");
                      }}
                    >
                      <Combine />
                    </Button>
                    <Button
                      aria-label={`删除${tag.name}`}
                      disabled={tag.articleCount > 0}
                      size="icon"
                      variant="ghost"
                      onClick={() => void remove(tag)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </ManagementList>
          )}
          {!isLoading && !readFailed && pagination.totalPages > 1 ? (
            <ManagementPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => void loadTags(page, searchText.trim() || undefined)}
            />
          ) : null}
        </ManagementBody>
        {confirmationDialog}
      </ManagementSurface>
    </ArticleArchiveLayout>
  );
}

function errorMessage(error: unknown) {
  if (error instanceof AdminApiError && error.code === "ADMIN_ARTICLE_TAG_IN_USE")
    return "该标签仍有文章引用，请使用合并或先移除引用。";
  if (error instanceof AdminApiError && error.code === "ADMIN_ARTICLE_TAG_CONFLICT")
    return "标签名称或 slug 已存在。";
  return "标签操作失败，请检查输入或服务端状态。";
}

export { ArticleTagManagement };
