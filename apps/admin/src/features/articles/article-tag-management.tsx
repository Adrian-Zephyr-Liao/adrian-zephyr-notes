import type { AdminArticleTagResponse } from "@adrian-zephyr-notes/contracts";
import { Combine, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  ManagementBody,
  ManagementEmpty,
  ManagementHeader,
  ManagementList,
  ManagementLoading,
  ManagementSurface,
  ManagementToolbar,
} from "../../components/ui/management-surface";
import { Select } from "../../components/ui/select";
import { ArticleTaxonomyPagination } from "./article-taxonomy-pagination";
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
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalItems: 0, totalPages: 0 });

  const loadTags = useCallback(async (page = 1, q?: string) => {
    setIsLoading(true);
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
      setMessage("标签列表加载失败，请检查服务端状态。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

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
      await loadTags(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function remove(tag: AdminArticleTagResponse) {
    if (!window.confirm(`删除标签「${tag.name}」？`)) return;
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
    if (
      !target ||
      !window.confirm(`将「${mergeSource.name}」合并到「${target.name}」？源标签会被删除。`)
    )
      return;
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
    <ManagementSurface>
      <ManagementHeader
        description="维护可复用标签，并合并重复条目。"
        meta={<span className="text-xs text-muted-foreground">{pagination.totalItems} 个</span>}
        title="文章标签"
      />
      <ManagementBody className="grid gap-4">
        {message ? (
          <p
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {message}
          </p>
        ) : null}
        <div className="grid gap-3 rounded-lg bg-background/24 p-3 lg:grid-cols-[1fr_1fr_auto]">
          <Input
            aria-label="标签名称"
            maxLength={80}
            placeholder="标签名称"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            aria-label="标签 slug"
            maxLength={80}
            placeholder="tag-slug"
            value={draft.slug}
            onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
          />
          <div className="flex gap-2">
            {editingId ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                }}
              >
                取消
              </Button>
            ) : null}
            <Button disabled={isSaving} onClick={() => void save()}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
              {editingId ? "保存" : "新增"}
            </Button>
          </div>
        </div>
        {mergeSource ? (
          <div className="grid gap-3 rounded-lg bg-primary/8 p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <p className="text-xs text-muted-foreground">源标签</p>
              <p className="font-medium">
                {mergeSource.name} · {mergeSource.articleCount} 篇文章
              </p>
            </div>
            <label className="grid gap-1">
              <span className="text-xs text-muted-foreground">目标标签</span>
              <Select value={targetTagId} onChange={(event) => setTargetTagId(event.target.value)}>
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
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
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
        {isLoading ? (
          <ManagementLoading label="正在加载标签..." />
        ) : tags.length === 0 ? (
          <ManagementEmpty label="暂无文章标签。" />
        ) : (
          <ManagementList>
            {tags.map((tag) => (
              <div
                key={tag.id}
                className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium">{tag.name}</p>
                  <p className="text-xs text-muted-foreground">{tag.slug}</p>
                </div>
                <span className="text-sm text-muted-foreground">{tag.articleCount} 篇文章</span>
                <div className="flex justify-end gap-1">
                  <Button
                    aria-label={`编辑${tag.name}`}
                    size="icon"
                    variant="ghost"
                    onClick={() => {
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
        <ArticleTaxonomyPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => void loadTags(page, searchText.trim() || undefined)}
        />
      </ManagementBody>
    </ManagementSurface>
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
