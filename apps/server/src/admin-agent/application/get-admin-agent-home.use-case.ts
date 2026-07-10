import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_AGENT_HOME_REPOSITORY,
  type AdminAgentHomeRepository,
  type AdminAgentHomeSnapshot,
  type AdminAgentRecentAction,
} from "../domain/admin-agent-home.repository";
import {
  evaluateAdminAgentAutomationEligibility,
  type AdminAgentAutomationPolicy,
} from "../domain/admin-agent-automation-policy";
import {
  ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY,
  type AdminAgentAutomationPolicyRepository,
} from "../domain/admin-agent-automation-policy.repository";
import {
  listAdminAgentCapabilities,
  type AdminAgentCapability,
} from "../domain/admin-agent-capability";
import {
  listAdminAgentWorkflowTasks,
  type AdminAgentWorkflowTaskCatalogItem,
} from "../domain/admin-agent-workflow-metadata";

type AdminAgentHome = AdminAgentHomeSnapshot & {
  assistantBrief: string;
  automationCandidateCount: number;
  automationPolicy: AdminAgentAutomationPolicy;
  capabilities: AdminAgentCapability[];
  lastUpdatedAt: Date;
  tasks: AdminAgentWorkflowTaskCatalogItem[];
};

const recentActionLimit = 5;

@Injectable()
class GetAdminAgentHomeUseCase {
  constructor(
    @Inject(ADMIN_AGENT_HOME_REPOSITORY)
    private readonly adminAgentHomeRepository: AdminAgentHomeRepository,
    @Inject(ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY)
    private readonly adminAgentAutomationPolicyRepository: AdminAgentAutomationPolicyRepository,
  ) {}

  async execute(now = new Date()): Promise<AdminAgentHome> {
    const { todayEnd, todayStart } = createLocalDayRange(now);
    const snapshot = await this.adminAgentHomeRepository.getHomeSnapshot({
      recentActionLimit,
      todayEnd,
      todayStart,
    });

    const automationPolicy = await this.adminAgentAutomationPolicyRepository.getPolicy();
    const automationCandidateCount = countAutomationCandidates(snapshot, automationPolicy);

    return {
      ...snapshot,
      assistantBrief: createAssistantBrief({
        ...snapshot,
        automationCandidateCount,
      }),
      automationCandidateCount,
      automationPolicy,
      capabilities: listAdminAgentCapabilities(),
      lastUpdatedAt: now,
      tasks: listAdminAgentWorkflowTasks(),
    };
  }
}

function createLocalDayRange(now: Date) {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  return { todayEnd, todayStart };
}

function countAutomationCandidates(
  snapshot: Pick<AdminAgentHomeSnapshot, "findings">,
  policy: AdminAgentAutomationPolicy,
) {
  return snapshot.findings.filter(
    (finding) => evaluateAdminAgentAutomationEligibility(finding, policy).eligible,
  ).length;
}

function createAssistantBrief(
  snapshot: AdminAgentHomeSnapshot & {
    automationCandidateCount?: number;
  },
) {
  if (snapshot.todayCommentCount === 0) {
    return "今天还没有新增文章评论。评论治理队列保持空闲，最近动作可从右侧审计摘要继续追踪。";
  }

  const actionText =
    snapshot.executedActionCount > 0
      ? `今天已执行 ${snapshot.executedActionCount} 次评论治理动作。`
      : "今天暂未执行评论治理动作。";
  const findingText =
    snapshot.pendingFindingCount > 0
      ? `当前还有 ${snapshot.pendingFindingCount} 条风险建议等待人工确认。`
      : "当前没有待确认风险建议。";
  const automationText =
    snapshot.automationCandidateCount && snapshot.automationCandidateCount > 0
      ? `其中 ${snapshot.automationCandidateCount} 条符合自动化候选条件，仍需管理员确认。`
      : "";

  return `今天新增 ${snapshot.todayCommentCount} 条文章评论，其中 ${snapshot.todayVisibleCommentCount} 条当前可见、${snapshot.todayHiddenCommentCount} 条已隐藏。${actionText}${findingText}${automationText}`;
}

export {
  GetAdminAgentHomeUseCase,
  countAutomationCandidates,
  createAssistantBrief,
  createLocalDayRange,
};
export type { AdminAgentHome, AdminAgentRecentAction };
