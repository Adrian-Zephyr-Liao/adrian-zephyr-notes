import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cloud, CloudOff, HardDrive, Loader2, LogOut, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { logoutAdmin } from "../../lib/admin-api";
import {
  ArticleViewModeTabs,
  ArticleWritingSurface,
  type ArticleEditorViewMode,
} from "./article-editor";
import { createArticleLocalDraftKey } from "./article-local-draft";
import { formatArticleEditorDateTime } from "./article-editor-model";
import { useArticleWriting } from "./use-article-writing";

type ArticleWritingPageProps = {
  admin: AdminUserResponse;
  articleId?: string;
  onLogout: () => void;
};

function ArticleWritingPage({ admin, articleId, onLogout }: ArticleWritingPageProps) {
  return (
    <ArticleWritingSession
      key={createArticleLocalDraftKey({ adminLogin: admin.login, articleId })}
      admin={admin}
      articleId={articleId}
      onLogout={onLogout}
    />
  );
}

function ArticleWritingSession({ admin, articleId, onLogout }: ArticleWritingPageProps) {
  const navigate = useNavigate();
  const isCreating = !articleId;
  const [editorMode, setEditorMode] = useState<ArticleEditorViewMode>("split");
  const {
    article,
    taxonomyOptions,
    values,
    isLoading,
    isSaving,
    isDeleted,
    errorMessage,
    localDraftMessage,
    cloudDraftMessage,
    savedMessage,
    isOnline,
    handleEditorChange,
    saveArticle,
    removeArticle,
    confirmationDialog,
    hasConflictingDraft,
    restoreConflictingDraft,
    reloadArticle,
  } = useArticleWriting({ adminLogin: admin.login, articleId });
  const pageTitle = isCreating ? "新建文章" : values.title.trim() || article?.title || "编辑文章";

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
                ? `${article.slug} · ${article.wordCount} 字 · 约 ${article.readingMinutes} 分钟 · ${formatArticleEditorDateTime(article.updatedAt)}`
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
            disabled={isSaving || isLoading || isDeleted || (!isCreating && !article)}
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
          {errorMessage ? (
            <p className="text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
          {!isCreating && !article && !isLoading && !isDeleted ? (
            <Button size="sm" type="button" variant="outline" onClick={reloadArticle}>
              重新加载文章
            </Button>
          ) : null}
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
          {hasConflictingDraft ? (
            <Button
              disabled={isSaving}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => void restoreConflictingDraft()}
            >
              恢复旧版本草稿
            </Button>
          ) : null}
          {savedMessage ? (
            <p className="text-muted-foreground" role="status">
              {savedMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      <section className="min-h-0 flex-1 overflow-hidden">
        {isDeleted ? (
          <div className="grid h-full place-content-center gap-4 p-6 text-center" role="status">
            <p>文章已删除</p>
            <Button type="button" variant="outline" onClick={() => void navigate({ to: "/" })}>
              返回文章管理
            </Button>
          </div>
        ) : (
          <ArticleWritingSurface
            editorMode={editorMode}
            isLoading={isLoading}
            taxonomyOptions={taxonomyOptions}
            values={values}
            onChange={handleEditorChange}
          />
        )}
      </section>
      {confirmationDialog}
    </main>
  );
}

export { ArticleWritingPage };
