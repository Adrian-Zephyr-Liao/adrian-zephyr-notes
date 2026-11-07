import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Cloud, CloudOff, HardDrive, Loader2, Save, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { AdminAccount } from "../../components/admin/admin-account";
import { AdminThemeToggle } from "../../components/admin/admin-theme-toggle";
import {
  ArticleViewModeTabs,
  ArticleWritingSurface,
  type ArticleEditorViewMode,
} from "./article-editor";
import { createArticleLocalDraftKey } from "./article-local-draft";
import { useAdminLogout } from "../auth/use-admin-logout";
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
  const logoutButton = useRef<HTMLButtonElement>(null);
  const logout = useAdminLogout(onLogout, [logoutButton]);
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
  const statusLabel = { DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "归档" }[values.status];

  return (
    <main className="flex h-dvh min-h-0 flex-col bg-background px-4 text-foreground sm:px-7 xl:px-12">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-border py-4 sm:py-5">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <h1 className="shrink-0 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            AZ Notes <span className="font-normal text-primary">/ 校样间</span>
          </h1>
          <span className="hidden border-r border-border pr-6 font-display text-[10px] tracking-[0.18em] text-muted-foreground xl:block">
            THE PROOF ROOM
          </span>
          <Button
            aria-label="返回文章管理"
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => void navigate({ to: "/articles" })}
          >
            <ArrowLeft />
            <span className="hidden sm:inline">内容档案</span>
          </Button>
          <span
            className="hidden truncate text-xs text-muted-foreground lg:block"
            title={pageTitle}
          >
            {statusLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isOnline ? (
            <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
              <CloudOff className="size-3.5" />
              离线
            </span>
          ) : null}
          <Button
            disabled={isSaving || isLoading || isDeleted || (!isCreating && !article)}
            type="button"
            aria-describedby="article-save-behavior"
            onClick={() => void saveArticle()}
          >
            {isSaving ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <Save />}
            {isSaving ? "保存中" : "保存"}
          </Button>
          {article ? (
            <Button
              disabled={isSaving}
              aria-label="删除"
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => void removeArticle()}
            >
              <Trash2 />
              <span className="hidden sm:inline">删除</span>
              <span className="sr-only sm:hidden">删除</span>
            </Button>
          ) : null}
          <span className="mx-1 h-6 w-px bg-border" aria-hidden="true" />
          <AdminThemeToggle />
          <AdminAccount
            admin={admin}
            buttonRef={logoutButton}
            onLogout={logout.requestLogout}
            pending={logout.pending}
            showIdentity={false}
          />
        </div>
      </header>
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3 border-b border-border pt-1 sm:mb-5">
        <ArticleViewModeTabs editorMode={editorMode} onModeChange={setEditorMode} />
        <p className="hidden truncate text-xs text-muted-foreground lg:block" title={pageTitle}>
          {pageTitle}
        </p>
      </div>
      {errorMessage || cloudDraftMessage || localDraftMessage || savedMessage ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3 text-xs">
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
      <section className="relative min-h-0 flex-1 overflow-hidden">
        {isDeleted ? (
          <div className="grid h-full place-content-center gap-4 p-6 text-center" role="status">
            <p>文章已删除</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate({ to: "/articles" })}
            >
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
      <footer className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-border py-3 text-[11px] text-muted-foreground">
        <span className="font-display text-xs tabular-nums">
          正文 {values.markdown.length.toLocaleString("zh-CN")} 字符
        </span>
        <span id="article-save-behavior">保存时将设为：{statusLabel}</span>
        <span className="hidden sm:inline">⌘ / Ctrl + B 加粗 · ⌘ / Ctrl + I 斜体</span>
      </footer>
      {confirmationDialog}
      {logout.feedback}
    </main>
  );
}

export { ArticleWritingPage };
