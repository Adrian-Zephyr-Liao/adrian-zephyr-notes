# Agent 工作台编排架构

## 目标

Agent 工作台是后台管理的统一对话入口。评论治理只是其中一个业务处理，后续文章、站点配置、审计分析和跨域任务都必须通过同一套编排能力接入。

成功标准：

- Agent 对话始终走真实 LLM 流式回复；没有静态占位回复。
- CopilotKit 负责对话、工具调用渲染和用户确认交互。
- LangGraph 只作为服务端内部持久化编排运行时，不在前端暴露节点、线程、checkpoint 等实现细节。
- 每个业务处理都支持持久化、取消、重试、分支和人工审批节点。
- 写操作必须通过可审计的确认动作执行，并具备幂等保护。
- 评论、文章、站点、审计、多任务使用统一注册表接入，但业务规则保留在各自领域边界内。

## 分层职责

### Admin 前端

位置：`apps/admin/src/features/agent-workbench`

前端只负责业务交互：

- 展示对话消息、LLM 流式内容、工具卡片和执行回执。
- 通过 CopilotKit `useHumanInTheLoop` 注册可交互工具。
- `ask_user_question` 只承载用户选择，不渲染后台 action payload、JSON、YAML 或代码块。
- `start_admin_agent_task` 只启动业务处理并展示业务结果。
- `control_admin_agent_task` 只处理业务任务控制：取消、重试、另开分支和多任务汇总刷新。
- 不展示 LangGraph 节点、checkpoint、threadId 或 workflowName。
- `/audit` 只展示业务审计日志，不能作为 LangGraph run、checkpoint 或节点运行态面板。

### Admin Agent 应用层

位置：`apps/server/src/admin-agent/application`

应用层负责用例编排和事务边界：

- `ManageAdminAgentWorkflowsUseCase` 是启动、恢复、取消、重试、分支和查询业务处理的控制面。
- `RegisteredAdminAgentWorkflowRegistry` 把公共业务 taskName 映射到后端 workflow definition。
- 写操作通过 `ExecuteAdminAgentWorkflowActionUseCase` 进入统一 action executor。
- 多任务子流程由 `runAdminAgentMultiTaskChildren` 启动，并使用 dedupeKey 避免恢复或重放时重复创建。

### Admin Agent 领域层

位置：`apps/server/src/admin-agent/domain`

领域层只表达业务概念，不依赖 Nest、Prisma、HTTP 或前端 UI：

- workflow metadata：业务处理目录、公开 taskName、runType、approvalNode。
- approval request：人工确认问题、选项、业务 payload。
- action policy：哪些建议可自动化，哪些必须人工确认。
- workflow output：输出摘要和错误格式。

### Admin Agent 基础设施层

位置：`apps/server/src/admin-agent/infrastructure`

基础设施层负责外部系统和持久化：

- `LangGraphAdminAgentWorkflowRunner` 编译并执行 LangGraph 图。
- `PostgresSaver` 保存 LangGraph checkpoint，默认 `public` checkpoint 表由 Prisma migration
  管理，生产环境不使用 MemorySaver。
- Prisma repository 保存业务 run、workflow event、finding、action execution。
- LLM client 使用 OpenAI-compatible chat completion。

## 内部编排运行时原则

LangGraph 是服务端内部实现，负责持久化执行、恢复、分支和人工中断，不构成任何面向用户的产品形态。

必须遵守：

- 每次 `invoke` / `stream` 都传入稳定 `thread_id`。
- 生产使用 PostgreSQL-backed checkpoint；默认 `public` schema 的 checkpoint 表必须通过
  migration 管理，非默认 schema 才允许使用显式 setup 命令。
- 节点返回 partial update，不直接 mutate state。
- 图级 `retryPolicy` 只用于瞬时错误，例如 LLM、网络或数据库短暂波动；工作流配置缺失、权限/4xx、Abort 和额度不足等确定性错误不得自动重试。
- `interrupt()` 前不做非幂等副作用；恢复会重新执行 interrupt 之前的代码。
- 写操作放在确认节点之后，并通过 action execution 表做幂等保护。
- action execution 的 `SUCCEEDED` 结果永久复用；干净的 `RUNNING` 记录在短租约内阻止并发写入，租约过期后允许恢复重领，避免服务中断后任务永久卡住。
- 未完成任务可以被取消为 `CANCELLED`，取消会清空当前人工中断并写入业务事件；取消后的任务可通过 retry 重新执行。
- 分支基于已有 checkpoint fork 新 run，不覆盖原 run。
- `parentRunId` 只表达任务关联，`parentRunRelation` 表达关联语义：`BRANCH`、`RETRY` 或 `CHILD_TASK`。

禁止：

- 把内部编排运行态设计成独立前端页面、控制台或调试视图。
- 把 checkpoint、node、threadId、workflowName 暴露为用户可见文案。
- 在 LLM 消息里渲染 action payload 或内部 JSON。
- 为了兼容旧流程保留静态 fake response。

## 工作流目录

所有可启动业务处理从同一份 metadata catalog 注册：

```text
comment_moderation_analysis -> COMMENT_MODERATION_ANALYSIS
article_assistance -> ARTICLE_ASSISTANCE
site_config_review -> SITE_CONFIG_REVIEW
audit_review -> AUDIT_REVIEW
multi_task_orchestration -> MULTI_TASK_ORCHESTRATION
```

新增业务处理必须同时补齐：

- domain metadata：workflowName、taskName、runType、label、approvalNode。
- LangGraph runner：start、resume、branch 路径。
- application registry 覆盖。
- contracts：公开 taskName 和响应类型。
- frontend CopilotKit tool prompt 说明。
- persistence migration 或 repository 字段。
- 测试：metadata、registry、runner interrupt/resume/branch、UI 不泄漏运行时细节。

## 人工审批交互

人工审批分两层：

- LangGraph 节点使用 `interrupt()` 暂停业务处理。
- CopilotKit `ask_user_question` 把业务问题渲染为可点击选择。

用户点击选项即代表授权。前端随后调用 `agent_task_resume`，不再二次确认同一动作。

确认卡片必须展示：

- 要处理的业务对象。
- 处理动作。
- 影响范围。
- 成功或失败回执。

确认卡片不得展示：

- LangGraph node。
- threadId 或 checkpoint。
- 原始 resume payload。
- 后端内部 workflowName。

## 多任务编排

`multi_task_orchestration` 是父工作流，用于把一个用户意图拆成多个业务子流程。

规则：

- 多任务规划节点只决定要启动哪些业务处理，不直接执行写操作。
- 子流程仍然走各自的人工审批节点。
- 每个子流程使用 `parentRunId` 关联父任务，并用 `parentRunRelation = CHILD_TASK` 明确区别于 retry/branch。
- 多任务结果聚合和子流程去重查询必须同时过滤 `parentRunRelation = CHILD_TASK`，不能把 branch/retry 当成父任务的业务子结果。
- 公开任务列表 API 使用业务化 `relation=child|branch|retry` 查询；控制器再映射为内部 `CHILD_TASK|BRANCH|RETRY`，前端不直接依赖内部运行枚举。
- 任务响应同样只返回公开 `relation`；工作台加载父任务上下文时必须使用 `relation=child`，避免把分支和重试渲染成业务子任务。
- 工作台组装 `childBusinessTasks` 时也必须二次校验 `relation === "child"`；`branch` 和 `retry` 只能作为独立业务处理上下文出现，不能混入父任务的业务子流程。
- 每个子流程使用 deterministic dedupeKey，恢复或重放时复用已有子任务。
- 多任务 child result 使用 `childTaskKey` 作为稳定关联键；只有业务子流程 run 创建成功后才写入 `runId`，启动前失败时 `runId = null`，不能用空字符串占位。
- 单个子流程失败不会导致其他子流程结果丢失。

## 审计和可观测性

审计日志面向管理员展示业务活动，不展示内部编排调试信息。
审计页不是 LangGraph 运行面板，也不提供运行时状态、checkpoint 浏览或节点调试入口。

可展示：

- Agent 业务处理启动、控制动作和人工审批恢复。
- 资源类型和资源 ID。
- 业务动作。
- Agent 建议编号。
- 决策和执行结果。

应过滤：

- checkpoint 字段。
- thread 字段。
- workflow 字段。
- node 字段。
- raw LangGraph state。

后端仍可持久化这些字段用于排障，但不能把它们作为产品体验暴露给用户。

管理员显式触发的 Agent task 生命周期动作必须写入审计日志：

- `ADMIN_AGENT_TASK_STARTED`：管理员启动业务处理。
- `ADMIN_AGENT_TASK_CONTROLLED`：管理员取消、重试、分支或刷新业务处理。
- `ADMIN_AGENT_TASK_RESUMED`：管理员确认人工审批节点并恢复业务处理。

多任务编排自动启动的子流程不冒充管理员操作；它们通过父任务事件、`parentRunId` 和公开 `relation=child` 追踪。

## 验证清单

每次调整 Agent 工作台都至少验证：

- `vp check` 覆盖改动文件。
- 工作台 UI 测试不包含 `LangGraph`、`checkpoint`、`threadId`、`workflowName`、`node` 等可见运行时泄漏。
- runner 测试覆盖 start、interrupt、resume、branch。
- checkpoint 持久化表通过 Prisma migration 提交，不能只依赖启动时 setup。
- 控制面测试覆盖 cancel、retry、branch 和 refresh 的状态约束。
- runner 测试覆盖 transient retry，以及不可重试错误不会重复执行节点。
- 写操作测试覆盖成功、失败、幂等重放和过期执行租约恢复。
- 多任务测试覆盖 child dedupe、child failure isolation。
