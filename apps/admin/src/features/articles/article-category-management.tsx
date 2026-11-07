import type { AdminArticleCategoryResponse } from "@adrian-zephyr-notes/contracts";
import { FolderTree, Loader2, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
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
import { Textarea } from "../../components/ui/textarea";
import {
  AdminApiError,
  createAdminArticleCategory,
  deleteAdminArticleCategory,
  listAdminArticleCategories,
  updateAdminArticleCategory,
} from "../../lib/admin-api";

const emptyDraft = { description: "", name: "", slug: "" };
const PAGE_SIZE = 20;

function ArticleCategoryManagement() {
  const [categories, setCategories] = useState<AdminArticleCategoryResponse[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const loadCategories = useCallback(async (page = 1, q?: string) => {
    setIsLoading(true);
    setReadFailed(false);
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
      setReadFailed(true);
      setMessage("分类列表加载失败，请检查服务端状态。");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

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
      closeForm();
      await loadCategories(1, searchText.trim() || undefined);
    } catch (error) {
      setMessage(toCategoryErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCategory(category: AdminArticleCategoryResponse) {
    const confirmed = await confirm({
      confirmLabel: "删除分类",
      description: `分类「${category.name}」将被永久删除。`,
      title: "确认删除分类",
      variant: "destructive",
    });

    if (!confirmed) {
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
    openForm();
    setEditingId(category.id);
    setDraft({
      description: category.description ?? "",
      name: category.name,
      slug: category.slug,
    });
  }

  return (
    <ArticleArchiveLayout page="categories">
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
            新建分类
          </Button>
        }
        title="分类目录"
        subtitle="TOPICS & COLLECTIONS"
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
              aria-label={editingId ? "编辑分类" : "新建分类"}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                  <span>分类名称</span>
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
                  <span>分类 slug</span>
                  <Input
                    maxLength={80}
                    placeholder="category-slug"
                    value={draft.slug}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, slug: event.target.value }))
                    }
                  />
                </label>
              </div>
              <label className="grid gap-2 text-xs font-medium text-muted-foreground">
                <span>分类描述（可选）</span>
                <Textarea
                  maxLength={500}
                  rows={3}
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button disabled={isSaving} variant="outline" onClick={closeForm}>
                  取消
                </Button>
                <Button disabled={isSaving} onClick={() => void saveCategory()}>
                  {isSaving ? <Loader2 className="animate-spin" /> : null}
                  保存分类
                </Button>
              </div>
            </div>
          ) : null}
          <ManagementToolbar className="grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="搜索分类"
                className="pl-9"
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
          {readFailed ? null : (
            <CategoryRows
              categories={categories}
              isLoading={isLoading}
              onDelete={removeCategory}
              onEdit={editCategory}
            />
          )}
          {!isLoading && !readFailed && pagination.totalPages > 1 ? (
            <ManagementPagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => void loadCategories(page, searchText.trim() || undefined)}
            />
          ) : null}
        </ManagementBody>
        {confirmationDialog}
      </ManagementSurface>
    </ArticleArchiveLayout>
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
          className="grid gap-4 py-5 transition-colors hover:bg-muted/25 motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center"
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center text-primary">
              <FolderTree className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-xl font-medium">{category.name}</p>
              <p className="mt-1 font-mono text-[11px] wrap-break-word text-muted-foreground">
                {category.slug}
              </p>
              <p className="mt-1 text-xs/5 wrap-break-word text-muted-foreground">
                {category.description || "暂无描述"}
              </p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {category.articleCount} 篇文章
          </span>
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
