import type { AdminArticleCategoryResponse } from "@adrian-zephyr-notes/contracts";
import { Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { Textarea } from "../../components/ui/textarea";
import {
  AdminApiError,
  createAdminArticleCategory,
  deleteAdminArticleCategory,
  listAdminArticleCategories,
  updateAdminArticleCategory,
} from "../../lib/admin-api";
import { ArticleTaxonomyPagination } from "./article-taxonomy-pagination";

const emptyDraft = { description: "", name: "", slug: "" };
const PAGE_SIZE = 20;

function ArticleCategoryManagement() {
  const [categories, setCategories] = useState<AdminArticleCategoryResponse[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, totalItems: 0, totalPages: 0 });

  const loadCategories = useCallback(async (page = 1, q?: string) => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await listAdminArticleCategories({ page, pageSize: PAGE_SIZE, q });
      setCategories(response.data);
      setPagination({
        page: response.pagination.page,
        totalItems: response.pagination.totalItems,
        totalPages: response.pagination.totalPages,
      });
    } catch {
      setMessage("分类列表加载失败，请检查服务端状态。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  async function saveCategory() {
    if (!draft.name.trim() || !draft.slug.trim()) {
      setMessage("分类名称和 slug 不能为空。");
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      if (editingId) {
        await updateAdminArticleCategory(editingId, draft);
      } else {
        await createAdminArticleCategory(draft);
      }
      setDraft(emptyDraft);
      setEditingId(null);
      await loadCategories(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(toCategoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCategory(category: AdminArticleCategoryResponse) {
    if (!window.confirm(`删除分类「${category.name}」？`)) {
      return;
    }

    setMessage(null);
    try {
      await deleteAdminArticleCategory(category.id);
      await loadCategories(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(toCategoryErrorMessage(error));
    }
  }

  function editCategory(category: AdminArticleCategoryResponse) {
    setEditingId(category.id);
    setDraft({
      description: category.description ?? "",
      name: category.name,
      slug: category.slug,
    });
  }

  return (
    <ManagementSurface>
      <ManagementHeader
        description="用稳定的分类结构组织文章主题。"
        meta={<span className="text-xs text-muted-foreground">{pagination.totalItems} 个</span>}
        title="文章分类"
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
        <div className="grid gap-3 rounded-lg bg-background/24 p-3 lg:grid-cols-[1fr_1fr_1.5fr_auto]">
          <Input
            aria-label="分类名称"
            maxLength={80}
            placeholder="分类名称"
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <Input
            aria-label="分类 slug"
            maxLength={80}
            placeholder="category-slug"
            value={draft.slug}
            onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
          />
          <Textarea
            aria-label="分类描述"
            className="min-h-10 resize-none"
            maxLength={500}
            placeholder="分类说明（可选）"
            rows={1}
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
          />
          <div className="flex gap-2">
            {editingId ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyDraft);
                }}
              >
                取消
              </Button>
            ) : null}
            <Button disabled={isSaving} type="button" onClick={() => void saveCategory()}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Plus />}
              {editingId ? "保存" : "新增"}
            </Button>
          </div>
        </div>
        <ManagementToolbar className="grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="搜索名称、slug 或描述"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void loadCategories(1, searchText.trim() || undefined);
              }}
            />
          </div>
          <Button
            aria-label="刷新分类"
            size="icon"
            type="button"
            variant="outline"
            onClick={() => void loadCategories(pagination.page, searchText.trim() || undefined)}
          >
            <RefreshCw className={isLoading ? "animate-spin" : undefined} />
          </Button>
        </ManagementToolbar>
        <CategoryRows
          categories={categories}
          isLoading={isLoading}
          onDelete={removeCategory}
          onEdit={editCategory}
        />
        <ArticleTaxonomyPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={(page) => void loadCategories(page, searchText.trim() || undefined)}
        />
      </ManagementBody>
    </ManagementSurface>
  );
}

function CategoryRows({
  categories,
  isLoading,
  onDelete,
  onEdit,
}: {
  categories: AdminArticleCategoryResponse[];
  isLoading: boolean;
  onDelete: (category: AdminArticleCategoryResponse) => Promise<void>;
  onEdit: (category: AdminArticleCategoryResponse) => void;
}) {
  if (isLoading) return <ManagementLoading label="正在加载分类..." />;
  if (categories.length === 0) return <ManagementEmpty label="暂无文章分类。" />;

  return (
    <ManagementList>
      {categories.map((category) => (
        <div
          key={category.id}
          className="grid gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center"
        >
          <div className="min-w-0">
            <p className="font-medium">{category.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {category.slug} · {category.description || "暂无描述"}
            </p>
          </div>
          <span className="text-sm text-muted-foreground">{category.articleCount} 篇文章</span>
          <div className="flex justify-end gap-1">
            <Button
              aria-label={`编辑${category.name}`}
              size="icon"
              variant="ghost"
              onClick={() => onEdit(category)}
            >
              <Pencil />
            </Button>
            <Button
              aria-label={`删除${category.name}`}
              disabled={category.articleCount > 0}
              size="icon"
              variant="ghost"
              onClick={() => void onDelete(category)}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ))}
    </ManagementList>
  );
}

function toCategoryErrorMessage(error: unknown) {
  if (error instanceof AdminApiError && error.code === "ADMIN_ARTICLE_CATEGORY_IN_USE") {
    return "该分类仍有文章引用，需先调整文章分类后再删除。";
  }
  if (error instanceof AdminApiError && error.code === "ADMIN_ARTICLE_CATEGORY_CONFLICT") {
    return "分类名称或 slug 已存在。";
  }
  return "分类操作失败，请检查名称、slug 或服务端状态。";
}

export { ArticleCategoryManagement };
