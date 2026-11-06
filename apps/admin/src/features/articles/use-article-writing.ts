import type {
  AdminArticleDetailResponse,
  AdminArticleTaxonomyOptionsResponse,
} from "@adrian-zephyr-notes/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConfirmationDialog } from "../../components/ui/confirmation-dialog";
import {
  createAdminArticle,
  deleteAdminArticle,
  deleteCurrentAdminArticleEditorDraft,
  getAdminArticle,
  getCurrentAdminArticleEditorDraft,
  listAdminArticleTaxonomies,
  saveCurrentAdminArticleEditorDraft,
  updateAdminArticle,
} from "../../lib/admin-api";
import type { ArticleEditorValues } from "./article-editor";
import {
  createArticleLocalDraftKey,
  createArticleLocalDraftRecord,
  pickLatestRestorableArticleDraft,
  readArticleLocalDraft,
  removeArticleLocalDraft,
  writeArticleLocalDraft,
  type ArticleDraftCandidate,
} from "./article-local-draft";
import {
  createNewArticleEditorValues,
  formatArticleEditorDateTime,
  getStatusConfirmationText,
  getArticleEditorValidationMessage,
  requiresStatusConfirmation,
  toArticleMutationPayload,
  toEditorValues,
} from "./article-editor-model";

type ArticleWritingOptions = { adminLogin: string; articleId?: string };

const emptyTaxonomyOptions: AdminArticleTaxonomyOptionsResponse = { categories: [], tags: [] };

function useArticleWriting({ adminLogin, articleId }: ArticleWritingOptions) {
  const navigate = useNavigate();
  const isCreating = !articleId;
  const [article, setArticle] = useState<AdminArticleDetailResponse | null>(null);
  const articleRef = useRef<AdminArticleDetailResponse | null>(null);
  const [taxonomyOptions, setTaxonomyOptions] =
    useState<AdminArticleTaxonomyOptionsResponse>(emptyTaxonomyOptions);
  const [values, setValues] = useState<ArticleEditorValues>(() => createNewArticleEditorValues());
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const deleted = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUserEdited, setHasUserEdited] = useState(false);
  const [localDraftMessage, setLocalDraftMessage] = useState<string | null>(null);
  const [cloudDraftMessage, setCloudDraftMessage] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [conflictingDraft, setConflictingDraft] = useState<ArticleDraftCandidate | null>(null);
  const [isOnline, setIsOnline] = useState(() => isBrowserOnline());
  const visit = useRef(0);
  const mutationPending = useRef(false);
  const editRevision = useRef(0);
  const latestValues = useRef(values);
  const cloudSyncs = useRef(new Set<Promise<unknown>>());
  const { confirm, confirmationDialog } = useConfirmationDialog();
  const draftKey = createArticleLocalDraftKey({ adminLogin, articleId });

  useEffect(() => {
    let isActive = true;
    visit.current += 1;

    async function loadEditorData() {
      setIsLoading(true);
      setErrorMessage(null);
      setCloudDraftMessage(null);
      setLocalDraftMessage(null);
      setHasUserEdited(false);
      setConflictingDraft(null);

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
        const candidates: Array<ArticleDraftCandidate | null> = [
          localDraft
            ? {
                source: "local",
                baseArticleUpdatedAt: localDraft.baseArticleUpdatedAt,
                savedAt: localDraft.savedAt,
                values: localDraft.values,
              }
            : null,
          cloudDraft
            ? {
                source: "cloud",
                baseArticleUpdatedAt: cloudDraft.baseArticleUpdatedAt,
                savedAt: cloudDraft.savedAt,
                values: cloudDraft.values,
              }
            : null,
        ];
        const draftToRestore = pickLatestRestorableArticleDraft(
          candidates,
          serverValues,
          nextArticle?.updatedAt,
        );

        setArticle(nextArticle);
        articleRef.current = nextArticle;
        setValues(draftToRestore ? draftToRestore.values : serverValues);
        setErrorMessage(nextErrorMessage);

        if (!draftToRestore && nextArticle) {
          const conflict = pickLatestRestorableArticleDraft(candidates, serverValues, null);
          if (conflict) {
            setConflictingDraft(conflict);
            setLocalDraftMessage("检测到旧版本草稿，已保留且未覆盖当前文章");
          }
        }

        if (cloudDraftResult.status === "rejected") {
          setCloudDraftMessage("云端草稿暂时不可用，本机草稿仍会继续保护内容");
        }

        if (draftToRestore?.source === "local") {
          setLocalDraftMessage(
            `已恢复本机草稿，保存于 ${formatArticleEditorDateTime(draftToRestore.savedAt)}`,
          );
        }

        if (draftToRestore?.source === "cloud") {
          setCloudDraftMessage(
            `已恢复云端草稿，保存于 ${formatArticleEditorDateTime(draftToRestore.savedAt)}`,
          );
        }
      } else {
        const localDraft = readArticleLocalDraft(getBrowserStorage(), draftKey);

        if (localDraft) {
          setArticle(null);
          setValues(localDraft.values);
          setErrorMessage("服务端暂时不可用，已恢复本机草稿；请重新加载文章后再保存。");
          setLocalDraftMessage(
            `已恢复本机草稿，保存于 ${formatArticleEditorDateTime(localDraft.savedAt)}`,
          );
        } else {
          setErrorMessage("写作页加载失败，请检查服务端状态或管理员权限。");
        }
      }

      setIsLoading(false);
    }

    void loadEditorData();

    return () => {
      isActive = false;
      visit.current += 1;
    };
  }, [articleId, draftKey, isCreating, loadAttempt]);

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

  const persistLocalDraft = useCallback(
    (nextValues: ArticleEditorValues, baseArticle = articleRef.current) => {
      const targetKey = baseArticle
        ? createArticleLocalDraftKey({ adminLogin, articleId: baseArticle.id })
        : draftKey;
      const saved = writeArticleLocalDraft(
        getBrowserStorage(),
        targetKey,
        createArticleLocalDraftRecord({
          articleId: baseArticle?.id ?? articleId,
          baseArticleUpdatedAt: baseArticle?.updatedAt ?? null,
          values: nextValues,
        }),
      );

      if (saved) {
        if (targetKey !== draftKey) removeArticleLocalDraft(getBrowserStorage(), draftKey);
        setLocalDraftMessage(isOnline ? "已保留本机草稿" : "离线中，已保留本机草稿");
      } else {
        setErrorMessage("浏览器无法写入本机草稿，请检查隐私模式或存储权限。");
      }
      return saved;
    },
    [adminLogin, articleId, draftKey, isOnline],
  );

  const syncCloudDraft = useCallback(
    async (nextValues: ArticleEditorValues) => {
      if (mutationPending.current || deleted.current) return;
      const currentVisit = visit.current;
      const currentRevision = editRevision.current;
      const synchronization = saveCurrentAdminArticleEditorDraft({
        articleId: article?.id ?? articleId ?? null,
        baseArticleUpdatedAt: article?.updatedAt ?? null,
        clientSavedAt: new Date().toISOString(),
        values: nextValues,
      });
      cloudSyncs.current.add(synchronization);
      try {
        const savedDraft = await synchronization;

        if (
          visit.current === currentVisit &&
          editRevision.current === currentRevision &&
          !mutationPending.current &&
          !deleted.current
        ) {
          setCloudDraftMessage(
            `已同步云端草稿，保存于 ${formatArticleEditorDateTime(savedDraft.savedAt)}`,
          );
        }
      } catch {
        if (
          visit.current === currentVisit &&
          editRevision.current === currentRevision &&
          !mutationPending.current &&
          !deleted.current
        ) {
          setCloudDraftMessage("云端草稿同步失败，本机草稿仍已保留");
        }
      } finally {
        cloudSyncs.current.delete(synchronization);
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

  const renderedVisit = visit.current;
  latestValues.current = values;

  function handleEditorChange(nextValues: ArticleEditorValues) {
    if (visit.current !== renderedVisit || isLoading || deleted.current) {
      return;
    }
    editRevision.current += 1;
    latestValues.current = nextValues;
    setCloudDraftMessage(null);
    setSavedMessage(null);
    setHasUserEdited(true);
    setValues(nextValues);
    persistLocalDraft(nextValues);
  }

  async function restoreConflictingDraft() {
    if (!conflictingDraft || mutationPending.current) return;
    const currentVisit = visit.current;
    const currentRevision = editRevision.current;
    const confirmed = await confirm({
      title: "恢复旧版本草稿",
      description: "恢复会替换当前编辑内容，请核对与服务端版本的差异；保存后才会更新文章。",
      confirmLabel: "恢复草稿",
    });
    if (!confirmed || visit.current !== currentVisit || mutationPending.current) return;
    if (editRevision.current !== currentRevision) {
      setErrorMessage("确认期间内容已变化，请重新核对后恢复草稿。");
      return;
    }
    handleEditorChange(conflictingDraft.values);
    setConflictingDraft(null);
    setLocalDraftMessage("已恢复旧版本草稿，请核对后保存");
  }

  async function saveArticle() {
    if (mutationPending.current || isLoading || deleted.current || (!isCreating && !article)) {
      return;
    }
    const currentArticle = articleRef.current;
    const submittedValues = latestValues.current;
    const submittedRevision = editRevision.current;
    const currentVisit = visit.current;
    const validationMessage = getArticleEditorValidationMessage(submittedValues);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    mutationPending.current = true;
    setIsSaving(true);
    setErrorMessage(null);
    setSavedMessage(null);
    try {
      if (
        currentArticle &&
        requiresStatusConfirmation(currentArticle.status, submittedValues.status)
      ) {
        const isPublishing = submittedValues.status === "PUBLISHED";
        const confirmed = await confirm({
          confirmLabel: isPublishing ? "确认发布" : "确认归档",
          description: getStatusConfirmationText(submittedValues.status),
          title: isPublishing ? "确认发布文章" : "确认归档文章",
          variant: isPublishing ? "default" : "destructive",
        });
        if (!confirmed || visit.current !== currentVisit) return;
        if (editRevision.current !== submittedRevision) {
          setErrorMessage("确认期间内容已变化，请重新保存并确认。");
          return;
        }
      }

      persistLocalDraft(latestValues.current);
      const payload = toArticleMutationPayload(submittedValues);
      let savedArticle: AdminArticleDetailResponse;

      if (currentArticle) {
        savedArticle = await updateAdminArticle(currentArticle.id, payload);
      } else {
        savedArticle = await createAdminArticle(payload);
      }

      if (visit.current !== currentVisit) return;
      articleRef.current = savedArticle;
      setArticle(savedArticle);
      setSavedMessage("文章已保存，正在整理草稿");
      if (isCreating && !persistLocalDraft(latestValues.current, savedArticle)) {
        setErrorMessage("文章已创建，但新输入无法转存本机草稿；请保留此页并重试保存。");
        return;
      }
      if (isCreating || editRevision.current === submittedRevision) {
        // Finish this visit's earlier PUTs before deleting its committed draft.
        await Promise.allSettled(cloudSyncs.current);
        if (visit.current !== currentVisit) return;
        await deleteCloudDraftQuietly(articleId ?? null);
        if (visit.current !== currentVisit) return;
      }
      setCloudDraftMessage(null);
      const hasNewEdits = editRevision.current !== submittedRevision;
      if (hasNewEdits) {
        const persisted = persistLocalDraft(latestValues.current, savedArticle);
        if (isCreating && !persisted) {
          setErrorMessage("文章已创建，但新输入无法转存本机草稿；请保留此页并重试保存。");
          return;
        }
        setSavedMessage("提交版本已保存，后续修改仍保留为草稿");
      } else {
        setValues(toEditorValues(savedArticle));
        removeArticleLocalDraft(getBrowserStorage(), draftKey);
        if (isCreating) {
          removeArticleLocalDraft(
            getBrowserStorage(),
            createArticleLocalDraftKey({ adminLogin, articleId: savedArticle.id }),
          );
        }
        setHasUserEdited(false);
        setLocalDraftMessage(null);
        setSavedMessage("已保存");
      }

      if (isCreating) {
        try {
          await navigate({
            params: { articleId: savedArticle.id },
            replace: true,
            to: "/articles/$articleId/edit",
          });
        } catch {
          if (visit.current === currentVisit)
            setErrorMessage("文章已保存，页面跳转失败；可返回文章管理继续编辑。");
        }
      }
    } catch {
      if (visit.current === currentVisit) {
        setErrorMessage(
          "文章保存未获确认，当前内容已保留为本机草稿；请先核对文章管理中的结果，再决定是否重试。",
        );
      }
    } finally {
      if (visit.current === currentVisit) {
        mutationPending.current = false;
        setIsSaving(false);
      }
    }
  }

  async function removeArticle() {
    if (!article || mutationPending.current || isLoading) {
      return;
    }
    const currentVisit = visit.current;
    const currentArticle = article;
    mutationPending.current = true;
    setIsSaving(true);
    const confirmed = await confirm({
      confirmLabel: "删除文章",
      description: `删除文章「${article.title}」后，正文和关联评论都会被移除。此操作无法撤销。`,
      title: "确认删除文章",
      variant: "destructive",
    });

    if (!confirmed || visit.current !== currentVisit) {
      if (visit.current === currentVisit) {
        mutationPending.current = false;
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await deleteAdminArticle(currentArticle.id);
      if (visit.current !== currentVisit) return;
      deleted.current = true;
      setIsDeleted(true);
      articleRef.current = null;
      setArticle(null);
      setHasUserEdited(false);
      setCloudDraftMessage(null);
      setLocalDraftMessage(null);
      setSavedMessage(null);
      setConflictingDraft(null);
      removeArticleLocalDraft(
        getBrowserStorage(),
        createArticleLocalDraftKey({ adminLogin, articleId: currentArticle.id }),
      );
      try {
        await navigate({ to: "/" });
      } catch {
        if (visit.current === currentVisit)
          setErrorMessage("文章已删除，页面跳转失败；可返回文章管理。");
      }
    } catch {
      if (visit.current === currentVisit)
        setErrorMessage("文章删除未获确认，请先核对文章管理中的结果。");
    } finally {
      if (visit.current === currentVisit) {
        mutationPending.current = false;
        setIsSaving(false);
      }
    }
  }

  return {
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
    hasConflictingDraft: Boolean(conflictingDraft),
    restoreConflictingDraft,
    reloadArticle: () => setLoadAttempt((attempt) => attempt + 1),
  };
}

function getBrowserStorage() {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
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

export { useArticleWriting };
