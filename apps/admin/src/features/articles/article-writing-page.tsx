import type {
  AdminArticleDetailResponse,
  AdminArticleTaxonomyOptionsResponse,
  AdminUserResponse,
} from "@adrian-zephyr-notes/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cloud, CloudOff, HardDrive, Loader2, LogOut, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  createAdminArticle,
  deleteAdminArticle,
  deleteCurrentAdminArticleEditorDraft,
  getAdminArticle,
  getCurrentAdminArticleEditorDraft,
  listAdminArticleTaxonomies,
  logoutAdmin,
  saveCurrentAdminArticleEditorDraft,
  updateAdminArticle,
} from "../../lib/admin-api";
import {
  ArticleViewModeTabs,
  ArticleWritingSurface,
  type ArticleEditorValues,
  type ArticleEditorViewMode,
} from "./article-editor";
import {
  createArticleLocalDraftKey,
  createArticleLocalDraftRecord,
  pickLatestRestorableArticleDraft,
  readArticleLocalDraft,
  removeArticleLocalDraft,
  writeArticleLocalDraft,
} from "./article-local-draft";
import {
  createNewArticleEditorValues,
  getStatusConfirmationText,
  getArticleEditorValidationMessage,
  requiresStatusConfirmation,
  toArticleMutationPayload,
  toEditorValues,
} from "./article-editor-model";

type ArticleWritingPageProps = {
  admin: AdminUserResponse;
  articleId?: string;
  onLogout: () => void;
};

const emptyTaxonomyOptions: AdminArticleTaxonomyOptionsResponse = {
  categories: [],
  tags: [],
};

function ArticleWritingPage({ admin, articleId, onLogout }: ArticleWritingPageProps) {
  const navigate = useNavigate();
  const isCreating = !articleId;
  const [article, setArticle] = useState<AdminArticleDetailResponse | null>(null);
  const [taxonomyOptions, setTaxonomyOptions] =
    useState<AdminArticleTaxonomyOptionsResponse>(emptyTaxonomyOptions);
  const [values, setValues] = useState<ArticleEditorValues>(() => createNewArticleEditorValues());
  const [editorMode, setEditorMode] = useState<ArticleEditorViewMode>("split");
  const [isLoading, setIsLoading] = useState(!isCreating);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [localDraftMessage, setLocalDraftMessage] = useState<string | null>(null);
  const [cloudDraftMessage, setCloudDraftMessage] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => isBrowserOnline());
  const draftKey = useMemo(
    () => createArticleLocalDraftKey({ adminLogin: admin.login, articleId }),
    [admin.login, articleId],
  );

  useEffect(() => {
    let isActive = true;

    async function loadEditorData() {
      setIsLoading(!isCreating);
      setErrorMessage(null);
      setCloudDraftMessage(null);
      setLocalDraftMessage(null);
      setHasUserEdited(false);

      const [taxonomyResult, articleResult, cloudDraftResult] = await Promise.allSettled([
        listAdminArticleTaxonomies(),
        articleId ? getAdminArticle(articleId) : Promise.resolve(null),
        getCurrentAdminArticleEditorDraft(articleId),
      ]);

      if (!isActive) {
        return;
      }

      setTaxonomyOptions(
        taxonomyResult.status === "fulfilled" ? taxonomyResult.value : emptyTaxonomyOptions,
      );

      const nextErrorMessage =
        taxonomyResult.status === "rejected" ? "分类和标签加载失败，可先继续写正文。" : null;

      if (articleResult.status === "fulfilled") {
        const nextArticle = articleResult.value;
        const serverValues = nextArticle
          ? toEditorValues(nextArticle)
          : createNewArticleEditorValues();
        const localDraft = readArticleLocalDraft(getBrowserStorage(), draftKey);
        const cloudDraft = cloudDraftResult.status === "fulfilled" ? cloudDraftResult.value : null;
        const draftToRestore = pickLatestRestorableArticleDraft(
          [
            localDraft
              ? {
                  source: "local",
                  savedAt: localDraft.savedAt,
                  values: localDraft.values,
                }
              : null,
            cloudDraft
              ? {
                  source: "cloud",
                  savedAt: cloudDraft.savedAt,
                  values: cloudDraft.values,
                }
              : null,
          ],
          serverValues,
          nextArticle?.updatedAt,
        );

        setArticle(nextArticle);
        setValues(draftToRestore ? draftToRestore.values : serverValues);
        setErrorMessage(nextErrorMessage);

        if (cloudDraftResult.status === "rejected") {
          setCloudDraftMessage("云端草稿暂时不可用，本机草稿仍会继续保护内容");
        }

        if (draftToRestore?.source === "local") {
          setLocalDraftMessage(
            `已恢复本机草稿，保存于 ${formatDraftSavedAt(draftToRestore.savedAt)}`,
          );
        }

        if (draftToRestore?.source === "cloud") {
          setCloudDraftMessage(
            `已恢复云端草稿，保存于 ${formatDraftSavedAt(draftToRestore.savedAt)}`,
          );
        }
      } else {
        const localDraft = readArticleLocalDraft(getBrowserStorage(), draftKey);

        if (localDraft) {
          setArticle(null);
          setValues(localDraft.values);
          setErrorMessage("服务端暂时不可用，已恢复本机草稿；联网后可以继续保存。");
          setLocalDraftMessage(`已恢复本机草稿，保存于 ${formatDraftSavedAt(localDraft.savedAt)}`);
        } else {
          setErrorMessage("写作页加载失败，请检查服务端状态或管理员权限。");
        }
      }

      setIsLoading(false);
    }

    void loadEditorData();

    return () => {
      isActive = false;
    };
  }, [articleId, draftKey, isCreating]);

  useEffect(() => {
    function syncOnlineState() {
      setIsOnline(isBrowserOnline());
    }

    window.addEventListener("online", syncOnlineState);
    window.addEventListener("offline", syncOnlineState);

    return () => {
      window.removeEventListener("online", syncOnlineState);
      window.removeEventListener("offline", syncOnlineState);
    };
  }, []);

  const pageTitle = useMemo(() => {
    if (isCreating) {
      return "新建文章";
    }

    return values.title.trim() || article?.title || "编辑文章";
  }, [article?.title, isCreating, values.title]);

  const persistLocalDraft = useCallback(
    (nextValues: ArticleEditorValues) => {
      const saved = writeArticleLocalDraft(
        getBrowserStorage(),
        draftKey,
        createArticleLocalDraftRecord({
          articleId: article?.id ?? articleId,
          baseArticleUpdatedAt: article?.updatedAt ?? null,
          values: nextValues,
        }),
      );

      if (saved) {
        setLocalDraftMessage(isOnline ? "已保留本机草稿" : "离线中，已保留本机草稿");
      } else {
        setErrorMessage("浏览器无法写入本机草稿，请检查隐私模式或存储权限。");
      }
    },
    [article?.id, article?.updatedAt, articleId, draftKey, isOnline],
  );

  const syncCloudDraft = useCallback(
    async (nextValues: ArticleEditorValues) => {
      try {
        const savedDraft = await saveCurrentAdminArticleEditorDraft({
          articleId: article?.id ?? articleId ?? null,
          baseArticleUpdatedAt: article?.updatedAt ?? null,
          clientSavedAt: new Date().toISOString(),
          values: nextValues,
        });

        setCloudDraftMessage(`已同步云端草稿，保存于 ${formatDraftSavedAt(savedDraft.savedAt)}`);
      } catch {
        setCloudDraftMessage("云端草稿同步失败，本机草稿仍已保留");
      }
    },
    [article?.id, article?.updatedAt, articleId],
  );

  useEffect(() => {
    if (!hasUserEdited || isLoading || isSaving || !isOnline) {
      return;
    }

    const timer = window.setTimeout(() => {
      void syncCloudDraft(values);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [hasUserEdited, isLoading, isOnline, isSaving, syncCloudDraft, values]);

  function handleEditorChange(nextValues: ArticleEditorValues) {
    setCloudDraftMessage(null);
    setSavedMessage(null);
    setHasUserEdited(true);
    setValues(nextValues);
    persistLocalDraft(nextValues);
  }

  async function saveArticle() {
    const currentArticle = article;
    const validationMessage = getArticleEditorValidationMessage(values);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (article && requiresStatusConfirmation(article.status, values.status)) {
      const confirmed = window.confirm(getStatusConfirmationText(values.status));

      if (!confirmed) {
        return;
      }
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSavedMessage(null);
    persistLocalDraft(values);

    try {
      const payload = toArticleMutationPayload(values);
      let savedArticle: AdminArticleDetailResponse;

      if (isCreating) {
        savedArticle = await createAdminArticle(payload);
      } else if (currentArticle) {
        savedArticle = await updateAdminArticle(currentArticle.id, payload);
      } else {
        setErrorMessage("文章详情尚未加载完成，不能保存。");
        return;
      }

      setArticle(savedArticle);
      setValues(toEditorValues(savedArticle));
      removeArticleLocalDraft(getBrowserStorage(), draftKey);
      await deleteCloudDraftQuietly(article?.id ?? articleId ?? null);
      setCloudDraftMessage(null);
      setHasUserEdited(false);
      setLocalDraftMessage(null);
      setSavedMessage("已保存");

      if (isCreating) {
        await navigate({
          params: { articleId: savedArticle.id },
          replace: true,
          to: "/articles/$articleId/edit",
        });
      }
    } catch {
      setErrorMessage("文章保存失败，当前内容已保留为本机草稿，请检查网络、必填项或服务端状态。");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeArticle() {
    if (!article) {
      return;
    }

    const confirmed = window.confirm(`删除文章「${article.title}」？此操作会移除正文和关联评论。`);

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await deleteAdminArticle(article.id);
      await navigate({ to: "/" });
    } catch {
      setErrorMessage("文章删除失败，请稍后重试。");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex h-dvh min-h-0 flex-col bg-background text-foreground">
      <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-background/95 p-3 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-label="返回文章管理"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => void navigate({ to: "/" })}
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold sm:text-lg">{pageTitle}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {article
                ? `${article.slug} · ${article.wordCount} 字 · 约 ${article.readingMinutes} 分钟 · ${formatDateTime(article.updatedAt)}`
                : "草稿会在首次保存后进入文章管理"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isOnline ? (
            <span className="hidden items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground sm:inline-flex">
              <CloudOff className="size-3.5" />
              离线
            </span>
          ) : null}
          <div className="hidden md:block">
            <ArticleViewModeTabs editorMode={editorMode} onModeChange={setEditorMode} />
          </div>
          <Button
            disabled={isSaving || isLoading || (!isCreating && !article)}
            type="button"
            onClick={() => void saveArticle()}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            保存
          </Button>
          {article ? (
            <Button
              disabled={isSaving}
              type="button"
              variant="destructive"
              onClick={() => void removeArticle()}
            >
              <Trash2 />
              删除
            </Button>
          ) : null}
          <div className="hidden items-center gap-2 border-l border-border/70 pl-2 lg:flex">
            {admin.avatarUrl ? (
              <img
                alt={admin.login}
                className="size-8 rounded-full ring-1 ring-border"
                src={admin.avatarUrl}
              />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {admin.login.slice(0, 1).toUpperCase()}
              </span>
            )}
            <Button
              aria-label="退出登录"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => {
                void logoutAdmin().finally(onLogout);
              }}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-muted/25 px-3 py-2 md:hidden">
        <ArticleViewModeTabs editorMode={editorMode} onModeChange={setEditorMode} />
      </div>
      {errorMessage || cloudDraftMessage || localDraftMessage || savedMessage ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border/70 px-4 py-2 text-sm">
          {errorMessage ? <p className="text-destructive">{errorMessage}</p> : null}
          {cloudDraftMessage ? (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <Cloud className="size-4" />
              {cloudDraftMessage}
            </p>
          ) : null}
          {localDraftMessage ? (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <HardDrive className="size-4" />
              {localDraftMessage}
            </p>
          ) : null}
          {savedMessage ? <p className="text-muted-foreground">{savedMessage}</p> : null}
        </div>
      ) : null}
      <section className="min-h-0 flex-1 overflow-hidden">
        <ArticleWritingSurface
          editorMode={editorMode}
          isLoading={isLoading}
          taxonomyOptions={taxonomyOptions}
          values={values}
          onChange={handleEditorChange}
        />
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function formatDraftSavedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}

function getBrowserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function deleteCloudDraftQuietly(articleId: string | null) {
  try {
    await deleteCurrentAdminArticleEditorDraft(articleId);
  } catch {
    // Saving the article has already succeeded; stale cloud draft cleanup can retry later.
  }
}

export { ArticleWritingPage };
