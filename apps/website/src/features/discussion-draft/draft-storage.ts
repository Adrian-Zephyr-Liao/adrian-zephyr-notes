import type { DraftSnapshot, DraftValue } from "./types";

const emptyDraft = (): DraftValue => ({
  body: "",
  nickname: "",
  replyId: null,
  revision: crypto.randomUUID(),
});
const draftKey = (scope: string) => `azn:discussion-draft:v1:${encodeURIComponent(scope)}`;
function encodeDraft(value: DraftValue) {
  return JSON.stringify({ version: 1, ...value });
}
function readDraft(key: string): DraftSnapshot {
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return { key, value: emptyDraft() };
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid draft");
  const data = value as Record<string, unknown>;
  if (
    data.version !== 1 ||
    typeof data.body !== "string" ||
    data.body.length > 1000 ||
    typeof data.nickname !== "string" ||
    data.nickname.length > 32 ||
    !(data.replyId === null || (typeof data.replyId === "string" && data.replyId.length <= 256)) ||
    typeof data.revision !== "string"
  )
    throw new Error("Invalid draft");
  return {
    key,
    value: {
      body: data.body,
      nickname: data.nickname,
      replyId: data.replyId,
      revision: data.revision,
    },
  };
}
function saveDraft(snapshot: DraftSnapshot) {
  if (!snapshot.value.body && !snapshot.value.nickname && !snapshot.value.replyId)
    window.sessionStorage.removeItem(snapshot.key);
  else window.sessionStorage.setItem(snapshot.key, encodeDraft(snapshot.value));
}
function navigateToLogin(url: string) {
  window.location.assign(url);
}
export { draftKey, emptyDraft, encodeDraft, navigateToLogin, readDraft, saveDraft };
