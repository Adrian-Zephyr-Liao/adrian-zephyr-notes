import type { AdminAgentFinding } from "./admin-agent-finding.entity";

type AdminAgentRecentAction = {
  id: string;
  actorLogin: string;
  action: "ADMIN_AGENT_FINDING_CREATED" | "ADMIN_AGENT_FINDING_DECIDED" | "COMMENT_STATUS_UPDATED";
  resourceType: string;
  resourceId: string | null;
  summary: string;
  createdAt: Date;
};

type GetAdminAgentHomeSnapshotInput = {
  todayStart: Date;
  todayEnd: Date;
  recentActionLimit: number;
};

type AdminAgentHomeSnapshot = {
  todayCommentCount: number;
  todayVisibleCommentCount: number;
  todayHiddenCommentCount: number;
  pendingFindingCount: number;
  executedActionCount: number;
  findings: AdminAgentFinding[];
  recentActions: AdminAgentRecentAction[];
};

interface AdminAgentHomeRepository {
  getHomeSnapshot(input: GetAdminAgentHomeSnapshotInput): Promise<AdminAgentHomeSnapshot>;
}

const ADMIN_AGENT_HOME_REPOSITORY = Symbol("ADMIN_AGENT_HOME_REPOSITORY");

export { ADMIN_AGENT_HOME_REPOSITORY };
export type {
  AdminAgentHomeRepository,
  AdminAgentHomeSnapshot,
  AdminAgentRecentAction,
  GetAdminAgentHomeSnapshotInput,
};
