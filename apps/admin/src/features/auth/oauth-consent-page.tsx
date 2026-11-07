import type {
  AdminUserResponse,
  OAuthAuthorizationDecisionRequest,
  OAuthConsentResponse,
} from "@adrian-zephyr-notes/contracts";
import { ArrowLeft, Check, Loader2, ShieldCheck, Terminal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminThemeToggle } from "../../components/admin/admin-theme-toggle";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { decideOAuthAuthorization, getOAuthConsent } from "./oauth-api";

const scopeDescriptions = {
  "admin:read": "读取全部后台内容，包括文章与草稿、评论、留言、站点配置、审计日志和助手会话",
  "admin:write":
    "执行完整管理员操作，包括创建、修改和删除内容，上传图片，审核评论与留言，修改站点配置和公告，运行助手并审批操作",
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
  const scopes = new Set<string>(consent?.scopes);
  const permissionNotice = scopes.has("admin:write")
    ? "此授权包含完整后台管理权限。删除、发布、审核和设置修改会立即生效。"
    : scopes.has("admin:read")
      ? scopes.has("articles:write")
        ? "此授权可读取全部后台信息，修改权限仅限以上列出的文章操作。"
        : "此授权可读取全部后台信息，不允许上传、修改、删除或审批。"
      : "此授权仅用于文章，不包含删除文章、评论管理或站点设置。";

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
    <main className="min-h-dvh bg-background p-6 text-foreground sm:px-10">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 border-b border-border pb-5">
        <a
          className="rounded-sm font-display text-2xl font-semibold tracking-tight outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          href="/"
        >
          AZ Notes
        </a>
        <div className="flex items-center gap-5">
          <span className="hidden font-display text-[11px] tracking-[0.18em] text-muted-foreground sm:inline">
            PRIVATE WORKSPACE
          </span>
          <AdminThemeToggle />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-5xl gap-9 py-10 sm:py-14 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-20">
        <aside>
          <a
            className="inline-flex items-center gap-2 rounded-sm text-xs text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            href="/"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" /> 返回工作室
          </a>
          <p className="mt-10 font-display text-xs tracking-[0.16em] text-primary">
            AZ NOTES / DEVICE ACCESS
          </p>
          <p className="mt-5 font-display text-3xl/relaxed font-semibold tracking-tight sm:text-4xl/relaxed">
            确认一次连接。
          </p>
          <p className="mt-4 max-w-xs text-sm/7 text-muted-foreground">
            核对你的设备、账号与授权范围，将命令行连接到内容工作台。
          </p>
        </aside>
        <section className="min-w-0 border-y border-border bg-card/30 px-0 py-7 sm:px-6">
          <div className="mb-7 flex items-center gap-4 border-b border-border pb-6">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/25 text-primary">
              <Terminal className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-medium tracking-[0.18em] text-primary">设备授权</p>
              <h1 className="mt-1 font-display text-2xl font-semibold">授权博客命令行</h1>
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
                    className="h-11 bg-card/60 font-mono tracking-wider"
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
                    className="mt-4 border-y border-border py-5 font-mono text-2xl font-semibold tracking-widest text-primary"
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
                  <p className="mt-4 text-xs/5 text-muted-foreground">
                    授权有效期为 8 小时。{permissionNotice}
                    你可以在 CLI 中退出登录以撤销授权。
                  </p>
                </>
              )}

              {errorMessage && (
                <p
                  className="mt-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm/6 text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              {consent && (
                <div className="mt-7 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
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
        </section>
      </div>
      <footer className="mx-auto w-full max-w-6xl border-t border-border pt-5 font-display text-xs tracking-wide text-muted-foreground">
        AZ Notes Studio · Private workspace
      </footer>
    </main>
  );
}

function normalizeUserCode(code: string) {
  return code.trim().toUpperCase().replace(/\s/g, "");
}

export { OAuthConsentPage };
