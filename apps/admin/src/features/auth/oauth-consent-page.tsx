import type {
  AdminUserResponse,
  OAuthAuthorizationDecisionRequest,
  OAuthConsentResponse,
} from "@adrian-zephyr-notes/contracts";
import { Check, Loader2, ShieldCheck, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { decideOAuthAuthorization, getOAuthConsent } from "./oauth-api";

const scopeDescriptions = {
  "articles:read": "读取文章、草稿、分类和标签",
  "articles:write": "创建、修改和发布文章",
};

function OAuthConsentPage({
  admin,
  initialUserCode,
}: {
  admin: AdminUserResponse;
  initialUserCode: string;
}) {
  const [userCode, setUserCode] = useState(initialUserCode);
  const [lookup, setLookup] = useState({ code: normalizeUserCode(initialUserCode), attempt: 0 });
  const [consent, setConsent] = useState<OAuthConsentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(normalizeUserCode(initialUserCode)));
  const [pendingDecision, setPendingDecision] = useState<"allow" | "deny" | null>(null);
  const [attemptedRequest, setAttemptedRequest] =
    useState<OAuthAuthorizationDecisionRequest | null>(null);
  const [completed, setCompleted] = useState<"approved" | "denied" | null>(null);
  const submissionPending = useRef(false);

  useEffect(() => {
    if (!lookup.code) {
      return;
    }

    const controller = new AbortController();
    setConsent(null);
    setErrorMessage(null);
    setIsLoading(true);

    async function load() {
      try {
        const result = await getOAuthConsent(lookup.code, controller.signal);

        if (result.scopes.some((scope) => !Object.hasOwn(scopeDescriptions, scope))) {
          throw new Error("授权请求包含不支持的权限，请从 CLI 重新登录。");
        }

        if (!controller.signal.aborted) {
          setConsent(result);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setErrorMessage(error instanceof Error ? error.message : "无法读取授权请求。");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [lookup]);

  async function decide(decision: "allow" | "deny") {
    if (
      !consent ||
      submissionPending.current ||
      (attemptedRequest && attemptedRequest.decision !== decision)
    ) {
      return;
    }

    const request = attemptedRequest ?? { user_code: consent.userCode, decision };
    submissionPending.current = true;
    setAttemptedRequest(request);
    setPendingDecision(decision);
    setErrorMessage(null);

    try {
      const result = await decideOAuthAuthorization(request);
      setCompleted(result.status);
    } catch (error) {
      submissionPending.current = false;
      setPendingDecision(null);
      const detail = error instanceof Error ? error.message : "未能确认提交结果。";
      setErrorMessage(
        `${detail} 决定可能已保存，请重试刚才的${decision === "allow" ? "允许" : "拒绝"}决定以核对结果。`,
      );
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-(--gradient-soft) px-4 py-10 sm:px-6">
      <Card className="w-full max-w-xl border-white/55 bg-(--glass-surface-strong) shadow-(--shadow-glass-strong) dark:border-white/10">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
              <Terminal className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground">AZ NOTES</p>
              <h1 className="mt-1 text-xl font-semibold">授权博客命令行</h1>
            </div>
          </div>

          {completed ? (
            <div role="status">
              <Check className="mb-3 size-6 text-primary" aria-hidden="true" />
              <h2 className="font-medium">
                {completed === "approved" ? "已允许访问" : "已拒绝访问"}
              </h2>
              <p className="mt-2 text-sm/6 text-muted-foreground">
                请返回 CLI 查看结果。你可以关闭此页面。
              </p>
            </div>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (attemptedRequest || submissionPending.current) return;
                  setConsent(null);
                  setLookup((current) => ({
                    code: normalizeUserCode(userCode),
                    attempt: current.attempt + 1,
                  }));
                }}
              >
                <label className="text-sm font-medium" htmlFor="oauth-user-code">
                  CLI 显示的授权码
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="font-mono tracking-wider"
                    disabled={attemptedRequest !== null}
                    id="oauth-user-code"
                    maxLength={16}
                    onChange={(event) => setUserCode(event.target.value)}
                    placeholder="XXXX-XXXX"
                    required
                    spellCheck={false}
                    value={userCode}
                  />
                  <Button
                    disabled={isLoading || attemptedRequest !== null || !userCode.trim()}
                    type="submit"
                    variant="outline"
                  >
                    查找授权请求
                  </Button>
                </div>
              </form>

              {isLoading && (
                <p
                  className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  正在确认授权请求
                </p>
              )}

              {consent && (
                <>
                  <p className="mt-6 text-sm/6 text-muted-foreground">
                    <strong className="font-medium text-foreground">{consent.clientName}</strong>
                    {" 请求以 "}
                    <strong className="font-medium break-all text-foreground">
                      @{admin.login}
                    </strong>
                    {" 的身份访问博客。"}
                  </p>
                  <p className="mt-3 text-sm/6 text-muted-foreground">
                    请确认终端中的授权码与此处一致，且这是你刚刚发起的登录请求。
                  </p>
                  <p
                    className="mt-3 font-mono text-2xl font-semibold tracking-widest"
                    aria-label="待确认的授权码"
                  >
                    {consent.userCode}
                  </p>
                  <div className="mt-6 border-y border-border/70 py-5">
                    <h2 className="text-sm font-medium">允许后，CLI 可以</h2>
                    <ul className="mt-3 space-y-3 text-sm">
                      {consent.scopes.map((scope) => (
                        <li className="flex items-start gap-2.5" key={scope}>
                          <ShieldCheck
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <span>{scopeDescriptions[scope]}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-muted-foreground">
                    授权有效期为 8 小时。此授权仅用于文章，不包含删除文章、评论管理或站点设置。
                    你可以在 CLI 中退出登录以撤销授权。
                  </p>
                </>
              )}

              {errorMessage && (
                <p className="mt-5 text-sm/6 text-destructive" role="alert">
                  {errorMessage}
                </p>
              )}

              {consent && (
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    disabled={
                      pendingDecision !== null ||
                      (attemptedRequest !== null && attemptedRequest.decision !== "deny")
                    }
                    onClick={() => void decide("deny")}
                    variant="outline"
                  >
                    {pendingDecision === "deny"
                      ? "正在拒绝…"
                      : attemptedRequest?.decision === "deny"
                        ? "重试拒绝"
                        : "拒绝"}
                  </Button>
                  <Button
                    disabled={
                      pendingDecision !== null ||
                      (attemptedRequest !== null && attemptedRequest.decision !== "allow")
                    }
                    onClick={() => void decide("allow")}
                  >
                    {pendingDecision === "allow" && (
                      <Loader2
                        className="animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    )}
                    {pendingDecision === "allow"
                      ? "正在授权…"
                      : attemptedRequest?.decision === "allow"
                        ? "重试允许"
                        : "允许访问"}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function normalizeUserCode(code: string) {
  return code.trim().toUpperCase().replace(/\s/g, "");
}

export { OAuthConsentPage };
