import { Button } from "@/components/ui/button";
import type { useDiscussionDraft } from "./use-discussion-draft";

function DiscussionDraftNotice({ draft }: { draft: ReturnType<typeof useDiscussionDraft> }) {
  return (
    <div className="grid gap-2 text-sm">
      {draft.authFailed || draft.storageError ? (
        <div role="alert" className="grid gap-2 text-destructive">
          {draft.authFailed ? <p>登录未完成，可以重试登录。</p> : null}
          {draft.storageError ? <p>{draft.storageError}</p> : null}
          <div className="flex flex-wrap gap-2">
            {draft.authFailed ? (
              <Button type="button" size="sm" variant="outline" onClick={draft.login}>
                重试登录
              </Button>
            ) : null}
            {draft.storageError ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={draft.copy}
                  disabled={draft.copying}
                >
                  复制内容
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={draft.retrySave}>
                  重试保存
                </Button>
                {draft.canContinue ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={draft.continueAfterCopy}
                  >
                    已复制，继续登录
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {draft.status ? <output className="text-muted-foreground">{draft.status}</output> : null}
    </div>
  );
}
export { DiscussionDraftNotice };
