import type { AdminAgentCapabilityId } from "@adrian-zephyr-notes/contracts";

type AdminAgentCapabilityStatus = "AVAILABLE" | "PLANNED";

type AdminAgentCapability = {
  id: AdminAgentCapabilityId;
  title: string;
  description: string;
  status: AdminAgentCapabilityStatus;
  supportsChat: boolean;
  requiresApprovalForWrites: boolean;
};

const adminAgentCapabilities = [
  {
    description: "分析文章评论、生成风险建议，并在管理员确认后执行治理动作。",
    id: "comments",
    requiresApprovalForWrites: true,
    status: "AVAILABLE",
    supportsChat: true,
    title: "评论治理",
  },
  {
    description: "协助选题、草稿检查、发布前巡检和摘要生成。",
    id: "articles",
    requiresApprovalForWrites: true,
    status: "PLANNED",
    supportsChat: true,
    title: "文章工作台",
  },
  {
    description: "审核访客留言、识别风险内容，并准备可确认的处理建议。",
    id: "guestbook",
    requiresApprovalForWrites: true,
    status: "PLANNED",
    supportsChat: true,
    title: "留言板治理",
  },
  {
    description: "巡检首页、导航、公告和社交链接，生成可确认的站点管理规划。",
    id: "site",
    requiresApprovalForWrites: true,
    status: "AVAILABLE",
    supportsChat: true,
    title: "站点巡检",
  },
  {
    description: "解释最近后台动作、追踪治理记录，并辅助定位风险操作。",
    id: "audit",
    requiresApprovalForWrites: false,
    status: "AVAILABLE",
    supportsChat: true,
    title: "审计日志",
  },
] satisfies AdminAgentCapability[];

function listAdminAgentCapabilities() {
  return [...adminAgentCapabilities];
}

export { listAdminAgentCapabilities };
export type { AdminAgentCapability, AdminAgentCapabilityStatus };
