const adminAgentWorkflowNodeLabels = {
  analyze_articles: "分析文章",
  analyze_audit_logs: "分析审计日志",
  analyze_comments: "分析评论",
  analyze_site_config: "分析站点配置",
  apply_approval: "执行确认操作",
  cancelled: "取消任务",
  complete: "完成任务",
  complete_article_assistance: "完成文章协作",
  complete_audit_review: "完成审计分析",
  complete_multi_task: "完成多任务编排",
  complete_site_config_review: "完成站点配置巡检",
  human_approval: "等待管理员确认",
  load_articles: "读取文章",
  load_audit_logs: "读取审计日志",
  load_comments: "读取评论",
  load_site_config: "读取站点配置",
  persist_findings: "保存风险建议",
  plan_multi_task: "规划多任务",
  request_article_approval: "等待管理员确认",
  request_audit_approval: "等待管理员确认",
  request_multi_task_approval: "等待管理员确认",
  request_site_config_approval: "等待管理员确认",
  run_child_tasks: "启动子任务",
} as const;

type AdminAgentWorkflowNode = keyof typeof adminAgentWorkflowNodeLabels;

function toAdminAgentWorkflowNodeLabel(node: string | null | undefined) {
  if (!node) {
    return "当前任务";
  }

  return adminAgentWorkflowNodeLabels[node as AdminAgentWorkflowNode] ?? "当前任务";
}

export { adminAgentWorkflowNodeLabels, toAdminAgentWorkflowNodeLabel };
export type { AdminAgentWorkflowNode };
