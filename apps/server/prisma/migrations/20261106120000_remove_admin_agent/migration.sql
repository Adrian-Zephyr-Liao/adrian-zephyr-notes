BEGIN;

-- Remove assistant records from the shared audit log while retaining ordinary business operations.
DELETE FROM "admin_operation_logs"
WHERE "action" ~ '^ADMIN_AGENT_'
   OR "resource_type" ~* '^admin[_-]agent([_-]|$)'
   OR "metadata"->>'source' IN ('admin_agent', 'admin-agent')
   OR "metadata" ?| ARRAY[
     'agentRunId', 'agentTaskId', 'agentFindingId',
     'langGraphRunId', 'langgraphRunId', 'rawLangGraphState',
     'workflowRunId', 'workflowCheckpoint'
   ];

DELETE FROM "site_settings" WHERE "key" = 'admin-agent-automation-policy';

DROP TABLE IF EXISTS "admin_agent_decision_effects";
DROP TABLE IF EXISTS "admin_agent_workflow_action_executions";
DROP TABLE IF EXISTS "admin_agent_workflow_events";
DROP TABLE IF EXISTS "admin_agent_findings";
DROP TABLE IF EXISTS "admin_agent_messages";
DROP TABLE IF EXISTS "admin_agent_conversation_messages";
DROP TABLE IF EXISTS "admin_agent_conversations";
DROP TABLE IF EXISTS "admin_agent_runs";

-- These tables were created by the former assistant's PostgreSQL checkpointer.
DROP TABLE IF EXISTS "public"."checkpoint_writes";
DROP TABLE IF EXISTS "public"."checkpoint_blobs";
DROP TABLE IF EXISTS "public"."checkpoints";
DROP TABLE IF EXISTS "public"."checkpoint_migrations";

DROP TYPE IF EXISTS "AdminAgentDecisionEffectType";
DROP TYPE IF EXISTS "AdminAgentDecisionEffectStatus";
DROP TYPE IF EXISTS "AdminAgentWorkflowActionExecutionStatus";
DROP TYPE IF EXISTS "AdminAgentWorkflowEventType";
DROP TYPE IF EXISTS "AdminAgentFindingStatus";
DROP TYPE IF EXISTS "AdminAgentFindingTargetType";
DROP TYPE IF EXISTS "AdminAgentFindingCategory";
DROP TYPE IF EXISTS "AdminAgentFindingSeverity";
DROP TYPE IF EXISTS "AdminAgentProposedAction";
DROP TYPE IF EXISTS "AdminAgentMessageRole";
DROP TYPE IF EXISTS "AdminAgentChatMessageRole";
DROP TYPE IF EXISTS "AdminAgentRunStatus";

COMMIT;
