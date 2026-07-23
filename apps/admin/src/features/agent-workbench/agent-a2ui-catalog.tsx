import { adminAgentA2uiCatalogId } from "@adrian-zephyr-notes/contracts";
import type { AdminAgentActivityMessageResponse } from "@adrian-zephyr-notes/contracts";
import type { Message } from "@ag-ui/client";
import { createCatalog, type CatalogDefinitions } from "@copilotkit/a2ui-renderer";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  EyeOff,
  FileText,
  LoaderCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "../../components/ui/toggle-group";
import { hideAdminAgentCommentAnalysisFindings } from "../../lib/admin-api";
import { cn } from "../../lib/utils";
import { adminAgentId } from "./agent-tool-contracts";

const commentFindingSeveritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
const commentFindingCategorySchema = z.enum(["ABUSE", "HARASSMENT", "SENSITIVE", "SPAM", "OTHER"]);
const commentFindingSchema = z.object({
  articleSlug: z.string(),
  articleTitle: z.string(),
  authorLogin: z.string(),
  category: commentFindingCategorySchema,
  commentId: z.string(),
  commentStatus: z.enum(["HIDDEN", "VISIBLE"]),
  confidence: z.number().min(0).max(1),
  createdAt: z.string(),
  evidence: z.array(z.string()),
  excerpt: z.string(),
  findingId: z.string(),
  proposedAction: z.enum(["HIDE_COMMENT", "NO_ACTION"]),
  reason: z.string(),
  severity: commentFindingSeveritySchema,
  status: z.enum(["EXECUTED", "FAILED", "PENDING", "REJECTED", "RESTORED"]),
});

const agentA2uiDefinitions = {
  CommentAnalysisReview: {
    description: "Browsable review workspace for one persisted comment risk analysis.",
    props: z.object({
      analysisId: z.string(),
      analyzedCount: z.number().int().nonnegative(),
      counts: z.object({
        actionable: z.number().int().nonnegative(),
        high: z.number().int().nonnegative(),
        low: z.number().int().nonnegative(),
        medium: z.number().int().nonnegative(),
      }),
      findings: z.array(commentFindingSchema),
      scope: z.string(),
      summary: z.string(),
    }),
  },
} satisfies CatalogDefinitions;

type CommentFinding = z.infer<typeof commentFindingSchema>;
type CommentAnalysisReviewProps = z.infer<
  (typeof agentA2uiDefinitions)["CommentAnalysisReview"]["props"]
>;
type RiskFilter = "ACTIONABLE" | "ALL" | "HIGH" | "LOW" | "MEDIUM";

const pageSize = 8;
const executableFindingStatuses = new Set<CommentFinding["status"]>([
  "FAILED",
  "PENDING",
  "REJECTED",
  "RESTORED",
]);

const severityView = {
  HIGH: {
    icon: CircleAlert,
    label: "高风险",
    tone: "bg-destructive/10 text-destructive",
  },
  LOW: {
    icon: CheckCircle2,
    label: "低风险",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  MEDIUM: {
    icon: AlertTriangle,
    label: "中风险",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
} as const;

const categoryLabel = {
  ABUSE: "辱骂",
  HARASSMENT: "骚扰",
  OTHER: "其他",
  SENSITIVE: "敏感内容",
  SPAM: "广告引流",
} as const;

const adminAgentA2uiCatalog = createCatalog(
  agentA2uiDefinitions,
  {
    CommentAnalysisReview: ({ props }) => <ConnectedCommentAnalysisReview props={props} />,
  },
  {
    catalogId: adminAgentA2uiCatalogId,
    includeBasicCatalog: true,
  },
);

function ConnectedCommentAnalysisReview({ props }: { props: CommentAnalysisReviewProps }) {
  const { agent } = useAgent({ agentId: adminAgentId });
  const { copilotkit } = useCopilotKit();
  const conversationId = readConversationId(copilotkit.properties);
  const updateActivityMessage = useCallback(
    (activityMessage: AdminAgentActivityMessageResponse) => {
      const message = activityMessage as Message;
      const nextMessages = agent.messages.some((item) => item.id === message.id)
        ? agent.messages.map((item) => (item.id === message.id ? message : item))
        : [...agent.messages, message];

      agent.setMessages(nextMessages);
    },
    [agent],
  );

  return (
    <CommentAnalysisReview
      conversationId={conversationId}
      key={props.analysisId}
      props={props}
      onActivityUpdated={updateActivityMessage}
    />
  );
}

function CommentAnalysisReview({
  conversationId,
  props,
  onActivityUpdated,
}: {
  conversationId: string | null;
  props: CommentAnalysisReviewProps;
  onActivityUpdated: (message: AdminAgentActivityMessageResponse) => void;
}) {
  const [filter, setFilter] = useState<RiskFilter>(() =>
    props.findings.some(isFindingActionable) ? "ACTIONABLE" : "ALL",
  );
  const [page, setPage] = useState(1);
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(() => new Set());
  const [isConfirmingBatch, setIsConfirmingBatch] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastActionMessage, setLastActionMessage] = useState<string | null>(null);
  const findings = props.findings;
  const actionableCount = findings.filter(isFindingActionable).length;
  const filteredFindings = findings.filter((finding) => matchesFilter(finding, filter));
  const selectableFilteredFindings = filteredFindings.filter(isFindingActionable);
  const selectedCount = selectedFindingIds.size;
  const allFilteredSelected =
    selectableFilteredFindings.length > 0 &&
    selectableFilteredFindings.every((finding) => selectedFindingIds.has(finding.findingId));
  const someFilteredSelected = selectableFilteredFindings.some((finding) =>
    selectedFindingIds.has(finding.findingId),
  );
  const pageCount = Math.max(1, Math.ceil(filteredFindings.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleFindings = filteredFindings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  useEffect(() => {
    const actionableIds = new Set(
      findings.filter(isFindingActionable).map((item) => item.findingId),
    );

    setSelectedFindingIds((current) => {
      const next = new Set([...current].filter((findingId) => actionableIds.has(findingId)));
      return setsEqual(current, next) ? current : next;
    });
  }, [findings]);

  function selectFilter(value: string) {
    if (!isRiskFilter(value)) {
      return;
    }

    setFilter(value);
    setPage(1);
  }

  function toggleFinding(findingId: string, checked: boolean) {
    setSelectedFindingIds((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(findingId);
      } else {
        next.delete(findingId);
      }

      return next;
    });
  }

  function toggleFilteredFindings(checked: boolean) {
    setSelectedFindingIds((current) => {
      const next = new Set(current);

      for (const finding of selectableFilteredFindings) {
        if (checked) {
          next.add(finding.findingId);
        } else {
          next.delete(finding.findingId);
        }
      }

      return next;
    });
  }

  async function hideSelectedComments() {
    if (!conversationId || selectedCount === 0) {
      return;
    }

    const findingIds = [...selectedFindingIds];
    setErrorMessage(null);
    setLastActionMessage(null);
    setIsSubmittingBatch(true);

    try {
      const response = await hideAdminAgentCommentAnalysisFindings(
        conversationId,
        props.analysisId,
        {
          findingIds,
        },
      );

      onActivityUpdated(response.activityMessage);
      setSelectedFindingIds(new Set());
      setLastActionMessage(
        response.failedCount > 0
          ? `已隐藏 ${response.appliedCount} 条，${response.failedCount} 条处理失败并保留待处理状态。`
          : `已统一隐藏 ${response.appliedCount} 条评论，分析结果已更新。`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "批量隐藏失败，请稍后重试。");
    } finally {
      setIsSubmittingBatch(false);
      setIsConfirmingBatch(false);
    }
  }

  if (!conversationId) {
    return (
      <section
        aria-label="评论风险分析"
        className="w-full max-w-[min(760px,100%)] rounded-lg bg-(--glass-surface-strong) p-4 shadow-(--shadow-glass) backdrop-blur-xl"
      >
        <p className="text-sm text-destructive" role="alert">
          当前会话标识不可用，请刷新 Agent 工作台后重试。
        </p>
      </section>
    );
  }

  return (
    <section
      aria-label="评论风险分析"
      className="w-full max-w-[min(760px,100%)] overflow-hidden rounded-lg bg-(--glass-surface-strong) shadow-(--shadow-glass) backdrop-blur-xl"
    >
      <header className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
              <div>
                <h3 className="text-base font-semibold text-foreground">评论风险分析</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {props.scope} · 已分析 {props.analyzedCount} 条
                </p>
              </div>
              <span className="rounded-full bg-muted/60 px-3 py-1 text-xs font-medium text-foreground">
                {actionableCount > 0 ? `${actionableCount} 条待处理` : "待处理项已清空"}
              </span>
            </div>
            <p className="mt-3 max-w-[68ch] text-sm/6 whitespace-pre-wrap text-muted-foreground">
              {props.summary}
            </p>
          </div>
        </div>
      </header>

      <div className="border-t border-border/40 bg-background/20">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div className="w-full sm:w-auto">
            <ToggleGroup
              aria-label="筛选评论风险"
              className="flex w-full flex-wrap bg-muted/40 p-1 sm:w-fit"
              onValueChange={selectFilter}
              spacing={0}
              type="single"
              value={filter}
              variant="default"
            >
              <RiskFilterItem count={actionableCount} label="待处理" value="ACTIONABLE" />
              <RiskFilterItem count={findings.length} label="全部" value="ALL" />
              <RiskFilterItem count={props.counts.high} label="高风险" value="HIGH" />
              <RiskFilterItem count={props.counts.medium} label="中风险" value="MEDIUM" />
              <RiskFilterItem count={props.counts.low} label="低风险" value="LOW" />
            </ToggleGroup>
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {filteredFindings.length} 条结果
          </span>
        </div>

        {lastActionMessage ? (
          <p
            className="mx-4 mb-2 flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 sm:mx-5 dark:text-emerald-300"
            role="status"
          >
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            {lastActionMessage}
          </p>
        ) : null}

        {errorMessage ? (
          <p
            className="mx-4 mb-2 flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive sm:mx-5"
            role="alert"
          >
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {errorMessage}
          </p>
        ) : null}

        {actionableCount > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 px-4 py-3 sm:px-5">
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <Checkbox
                aria-label="全选当前筛选中的待处理评论"
                checked={
                  allFilteredSelected ? true : someFilteredSelected ? "indeterminate" : false
                }
                disabled={selectableFilteredFindings.length === 0 || isSubmittingBatch}
                onCheckedChange={toggleFilteredFindings}
              />
              <span>全选当前筛选</span>
            </label>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedCount > 0 ? `已选 ${selectedCount} 条` : "请选择要治理的评论"}
              </span>
              <Button
                disabled={selectedCount === 0 || isSubmittingBatch}
                size="sm"
                type="button"
                variant="destructive"
                onClick={() => setIsConfirmingBatch(true)}
              >
                {isSubmittingBatch ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <EyeOff aria-hidden="true" />
                )}
                {isSubmittingBatch ? "正在隐藏" : "隐藏选中评论"}
              </Button>
            </div>
          </div>
        ) : null}

        {visibleFindings.length > 0 ? (
          <Accordion collapsible type="single">
            {visibleFindings.map((finding) => (
              <CommentFindingRow
                finding={finding}
                isSelected={selectedFindingIds.has(finding.findingId)}
                isSelectionDisabled={isSubmittingBatch}
                key={finding.findingId}
                onSelectedChange={(checked) => toggleFinding(finding.findingId, checked)}
              />
            ))}
          </Accordion>
        ) : (
          <div className="grid min-h-32 place-items-center border-t border-border/40 px-4 text-center">
            <div>
              <CheckCircle2 aria-hidden="true" className="mx-auto size-5 text-emerald-600" />
              <p className="mt-2 text-sm font-medium text-foreground">
                {filter === "ACTIONABLE" ? "待处理项已清空" : "当前筛选下没有评论"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">完整分析仍保留在其他筛选项中。</p>
            </div>
          </div>
        )}

        {filteredFindings.length > pageSize ? (
          <nav
            aria-label="评论风险分页"
            className="flex items-center justify-between border-t border-border/40 px-4 py-3 sm:px-5"
          >
            <span className="text-xs text-muted-foreground tabular-nums">
              第 {currentPage} / {pageCount} 页
            </span>
            <div className="flex items-center gap-1">
              <Button
                aria-label="上一页"
                disabled={currentPage === 1}
                className="size-8"
                size="icon"
                title="上一页"
                type="button"
                variant="ghost"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                aria-label="下一页"
                disabled={currentPage === pageCount}
                className="size-8"
                size="icon"
                title="下一页"
                type="button"
                variant="ghost"
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </div>

      <AlertDialog
        open={isConfirmingBatch}
        onOpenChange={(open) => {
          if (!open) {
            setIsConfirmingBatch(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>隐藏选中的 {selectedCount} 条评论？</AlertDialogTitle>
            <AlertDialogDescription>
              确认后将统一隐藏这些评论，并用最新治理状态刷新当前分析列表。操作会记录到后台审计日志。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmittingBatch}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={selectedCount === 0 || isSubmittingBatch}
              variant="destructive"
              onClick={() => {
                void hideSelectedComments();
              }}
            >
              {isSubmittingBatch ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <EyeOff aria-hidden="true" />
              )}
              {isSubmittingBatch ? "正在隐藏" : "统一隐藏"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function CommentFindingRow({
  finding,
  isSelected,
  isSelectionDisabled,
  onSelectedChange,
}: {
  finding: CommentFinding;
  isSelected: boolean;
  isSelectionDisabled: boolean;
  onSelectedChange: (checked: boolean) => void;
}) {
  const view = severityView[finding.severity];
  const SeverityIcon = view.icon;
  const canHide = isFindingActionable(finding);

  return (
    <AccordionItem
      className="border-border/40 px-4 last:border-b-0 sm:px-5"
      value={finding.findingId}
    >
      <div className="flex min-w-0 items-center gap-3">
        {canHide ? (
          <Checkbox
            aria-label={`选择评论：${finding.excerpt}`}
            checked={isSelected}
            disabled={isSelectionDisabled}
            onCheckedChange={onSelectedChange}
          />
        ) : (
          <span aria-hidden="true" className="size-4 shrink-0" />
        )}
        <AccordionTrigger className="min-h-20 min-w-0 flex-1 items-center py-3 hover:no-underline">
          <div className="min-w-0 flex-1 pr-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex min-h-6 items-center gap-1 rounded-full px-2 text-xs font-medium",
                  view.tone,
                )}
              >
                <SeverityIcon aria-hidden="true" className="size-3" />
                {view.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {categoryLabel[finding.category]}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                置信度 {Math.round(finding.confidence * 100)}%
              </span>
              <FindingStatus finding={finding} />
            </div>
            <p className="mt-2 line-clamp-2 text-sm/6 font-medium text-foreground">
              {finding.excerpt}
            </p>
            <p className="mt-1 truncate text-xs font-normal text-muted-foreground">
              @{finding.authorLogin} · {finding.articleTitle}
            </p>
          </div>
        </AccordionTrigger>
      </div>

      <AccordionContent className="pb-4">
        <div className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:p-4">
          <div>
            <p className="font-medium text-foreground">判断依据</p>
            <p className="mt-1 text-sm/6 text-muted-foreground">{finding.reason}</p>
          </div>
          {finding.evidence.length > 0 ? (
            <div>
              <p className="font-medium text-foreground">命中证据</p>
              <ul className="mt-1 grid gap-1 text-sm/6 text-muted-foreground">
                {finding.evidence.map((item) => (
                  <li className="flex gap-2" key={item}>
                    <span
                      aria-hidden="true"
                      className="mt-2 size-1 shrink-0 rounded-full bg-current"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-2">
              <UserRound aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">@{finding.authorLogin}</span>
            </span>
            <span className="inline-flex min-w-0 items-center gap-2">
              <FileText aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{finding.articleTitle}</span>
            </span>
            <span>{formatCommentTime(finding.createdAt)}</span>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

function FindingStatus({ finding }: { finding: CommentFinding }) {
  if (finding.commentStatus === "HIDDEN" || finding.status === "EXECUTED") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <EyeOff aria-hidden="true" className="size-3" />
        已隐藏
      </span>
    );
  }

  if (isFindingActionable(finding)) {
    return <span className="text-xs text-muted-foreground">待处理</span>;
  }

  return <span className="text-xs text-muted-foreground">无需处理</span>;
}

function RiskFilterItem({
  count,
  label,
  value,
}: {
  count: number;
  label: string;
  value: RiskFilter;
}) {
  return (
    <ToggleGroupItem
      className="min-h-9 flex-1 gap-2 rounded-md px-3 text-xs data-[state=on]:bg-(--glass-surface-strong) data-[state=on]:text-foreground sm:flex-none"
      value={value}
    >
      <span>{label}</span>
      <span className="text-muted-foreground tabular-nums">{count}</span>
    </ToggleGroupItem>
  );
}

function isFindingActionable(finding: CommentFinding) {
  return (
    finding.proposedAction === "HIDE_COMMENT" &&
    finding.commentStatus === "VISIBLE" &&
    executableFindingStatuses.has(finding.status)
  );
}

function matchesFilter(finding: CommentFinding, filter: RiskFilter) {
  if (filter === "ALL") {
    return true;
  }

  return filter === "ACTIONABLE" ? isFindingActionable(finding) : finding.severity === filter;
}

function isRiskFilter(value: string): value is RiskFilter {
  return ["ACTIONABLE", "ALL", "HIGH", "LOW", "MEDIUM"].includes(value);
}

function readConversationId(properties: unknown) {
  if (!properties || typeof properties !== "object" || Array.isArray(properties)) {
    return null;
  }

  const value = (properties as Record<string, unknown>).conversationId;
  const conversationId = typeof value === "string" ? value.trim() : "";
  return conversationId || null;
}

function setsEqual(left: Set<string>, right: Set<string>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function formatCommentTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function AgentA2uiLoading() {
  return (
    <div
      aria-label="正在整理评论分析"
      className="w-full max-w-[min(760px,100%)] rounded-lg bg-(--glass-surface-strong) p-4 shadow-(--shadow-glass) backdrop-blur-xl"
      role="status"
    >
      <div className="flex items-center gap-3">
        <span className="size-10 animate-pulse rounded-lg bg-primary/10" />
        <div className="grid flex-1 gap-2">
          <span className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
          <span className="h-3 w-3/4 animate-pulse rounded-sm bg-muted/70" />
        </div>
      </div>
    </div>
  );
}

export { adminAgentA2uiCatalog, AgentA2uiLoading, CommentAnalysisReview };
