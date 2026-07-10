DELETE FROM "admin_agent_runs"
WHERE "workflow_name" NOT IN (
  'ARTICLE_ASSISTANCE',
  'AUDIT_REVIEW',
  'COMMENT_MODERATION_ANALYSIS',
  'MULTI_TASK_ORCHESTRATION',
  'SITE_CONFIG_REVIEW'
);

ALTER TABLE "admin_agent_runs"
  ALTER COLUMN "workflow_name" DROP DEFAULT;

ALTER TABLE "admin_agent_runs"
  ADD CONSTRAINT "admin_agent_runs_workflow_name_supported_chk"
  CHECK (
    "workflow_name" IN (
      'ARTICLE_ASSISTANCE',
      'AUDIT_REVIEW',
      'COMMENT_MODERATION_ANALYSIS',
      'MULTI_TASK_ORCHESTRATION',
      'SITE_CONFIG_REVIEW'
    )
  );
