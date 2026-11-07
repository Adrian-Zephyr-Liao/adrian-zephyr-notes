import { useCallback, useEffect, useRef, useState } from "react";
import {
  draftKey,
  emptyDraft,
  encodeDraft,
  navigateToLogin,
  readDraft,
  saveDraft,
} from "./draft-storage";
import type { DraftSnapshot, DraftValue } from "./draft-storage";

const SAVE_ERROR = "草稿暂时无法保存，请先复制内容再登录。";
function useDiscussionDraft(scope: string, loginUrl: string) {
  const key = draftKey(scope);
  const current = useRef<DraftSnapshot | null>(null);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState<DraftSnapshot | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [authFailed, setAuthFailed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const capture = useCallback(() => {
    if (current.current?.key === key) return current.current;
    try {
      current.current = readDraft(key);
    } catch {
      current.current = { key, value: emptyDraft() };
      setStorageError(SAVE_ERROR);
    }
    return current.current;
  }, [key]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    setStorageError(null);
    const restored = capture();
    setSnapshot(restored);
    setCopied(null);
    setCopying(false);
    setStatus(restored.value.body ? "已恢复保存的内容，请先核对是否已发布。" : null);
    setAuthFailed(new URLSearchParams(window.location.search).get("auth") === "failed");
  }, [capture]);

  function persist(saved = capture()) {
    try {
      saveDraft(saved);
      setStorageError(null);
      return true;
    } catch {
      setStorageError(SAVE_ERROR);
      return false;
    }
  }
  function update(patch: Partial<Pick<DraftValue, "body" | "nickname" | "replyId">>) {
    const saved = capture();
    const next = { key, value: { ...saved.value, ...patch, revision: crypto.randomUUID() } };
    current.current = next;
    setSnapshot(next);
    setCopied(null);
    setStatus(null);
    persist(next);
  }
  function login() {
    const saved = capture();
    // No unsent content can be lost, and unreadable old storage must stay untouched.
    if (!saved.value.body && !saved.value.nickname && !saved.value.replyId) {
      navigateToLogin(loginUrl);
      return;
    }
    if (persist(saved)) navigateToLogin(loginUrl);
  }
  async function copy() {
    const saved = capture();
    setCopying(true);
    try {
      const { body, nickname, replyId } = saved.value;
      await navigator.clipboard.writeText(
        `${nickname ? `昵称：${nickname}\n\n` : ""}${replyId ? `回复评论：${replyId}\n\n` : ""}${body}`,
      );
      if (!mounted.current || current.current?.key !== saved.key) return;
      if (current.current.value.revision !== saved.value.revision) {
        setStatus("内容已变化，请重新复制最新内容。");
        return;
      }
      setCopied(saved.value.revision);
      setStatus("内容已复制，请保存好副本，再选择继续登录。");
    } catch {
      if (mounted.current && current.current?.key === saved.key)
        setStatus("复制失败，请手动保留内容，或重试复制。");
    } finally {
      if (mounted.current && current.current?.key === saved.key) setCopying(false);
    }
  }
  function continueAfterCopy() {
    if (copied && capture().value.revision === copied) navigateToLogin(loginUrl);
  }
  function clearSubmitted(submitted: DraftSnapshot) {
    let failed = false;
    try {
      // Compare the exact submitted revision, including edits made after navigating away.
      const submittedValue = encodeDraft(submitted.value);
      if (window.sessionStorage.getItem(submitted.key) === submittedValue) {
        try {
          window.sessionStorage.removeItem(submitted.key);
        } catch {
          // Some storage policies allow overwriting but deny deletion. Recheck
          // ownership before replacing this exact submitted revision with an empty record.
          if (window.sessionStorage.getItem(submitted.key) === submittedValue)
            window.sessionStorage.setItem(submitted.key, encodeDraft(emptyDraft()));
        }
      }
    } catch {
      failed = true;
    }
    if (
      !mounted.current ||
      current.current?.key !== submitted.key ||
      current.current.value.revision !== submitted.value.revision
    )
      return;
    const cleared = { key: submitted.key, value: emptyDraft() };
    current.current = cleared;
    setSnapshot(cleared);
    setCopied(null);
    setStatus(null);
    setStorageError(failed ? "内容已发布，但草稿清理失败，请勿重复发布。" : null);
  }
  const value =
    snapshot?.key === key
      ? snapshot.value
      : { body: "", nickname: "", replyId: null, revision: "" };
  return {
    ...value,
    update,
    capture,
    clearSubmitted,
    login,
    storageError,
    authFailed,
    status,
    copy,
    copying,
    retrySave: () => persist(),
    canContinue: copied !== null && copied === value.revision,
    continueAfterCopy,
  };
}
export { useDiscussionDraft };
