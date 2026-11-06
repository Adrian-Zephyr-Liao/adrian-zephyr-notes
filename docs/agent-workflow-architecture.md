# Agent 工作台执行架构

## 目标与边界

Agent 工作台是后台管理的统一对话入口。`@earendil-works/pi-ai` 负责模型接入，
`@earendil-works/pi-durable` 负责对话、工具和业务任务的执行与恢复。所有 pi 包固定为
`1.5.0`，升级需要同时检查 API、持久化数据和恢复行为。

- 对话使用真实模型的流式回复。工具成功回执是“已执行”的依据。
- CopilotKit、AG-UI 和受信任的 A2UI catalog 负责产品交互，不负责决定业务授权。
- 评论、文章、站点配置、审计和多任务继续使用同一份业务目录。
- 领域层不依赖 pi、Nest、Prisma 或前端组件。
- 权限、审批、幂等写入和业务审计由服务端应用层负责。
- pi 的会话 ID、任务 ID、阶段名和 checkpoint 不作为用户可见的产品内容。
- 不向模型注册任意文件、进程或网络执行工具；业务工具只调用已有应用用例。

## 分层职责

### Admin 前端

位置：`apps/admin/src/features/agent-workbench`

前端展示对话、进度摘要、工具调用、评论审查卡片和执行回执。消息恢复仍使用公开的会话消息接口。
同一评论分析使用稳定的 activity messageId，隐藏或恢复后更新该卡片，而不是重复插入分析列表。

前端传入的上下文、会话标识、工具参数和用户内容都是不可信输入。后台重新读取实际资源，验证
已持久化的 finding、分析归属和审批对象。前端不能通过构造参数改变审批范围或管理员身份。

### 应用与领域层

位置：`apps/server/src/admin-agent/application`、`domain`

- `ManageAdminAgentWorkflowsUseCase` 提供启动、恢复、取消、重试、分支和查询任务的控制面。
- `RegisteredAdminAgentWorkflowRegistry` 将公开的 taskName 映射到业务处理定义。
- 评论搜索、分析、隐藏、恢复工具调用已有用例，不复制领域规则。
- `ExecuteAdminAgentWorkflowActionUseCase` 选择对应的业务 action handler。
- PostgreSQL 保存业务 run、消息、finding、审批、action execution、decision effect 和审计记录。
- `parentRunId` 表达任务关联，`parentRunRelation` 区分 `CHILD_TASK`、`BRANCH`、`RETRY`。

### pi 基础设施层

位置：`apps/server/src/admin-agent/infrastructure`

pi-durable 的 Harness 执行对话与业务任务；阶段需要的输入和结果写入持久化状态，不能只保存在
请求闭包或内存 Promise 中。pi-ai 为聊天和只读业务分析提供同一套模型接入。流式消息转换为
AG-UI 事件，界面与领域模型不依赖 pi 的内部数据结构。

业务数据保存在 PostgreSQL，运行状态保存在 SQLite。两者不共享事务；写操作必须拥有可重放的
业务身份和成功回执，恢复时先查询已提交的业务记录，再决定是否执行。pi 的 `replay: "safe"`
是工具实现需要满足的契约，不是跨数据库“只执行一次”的保证。

## 持久化与部署

`PI_AGENT_STORAGE_DIR` 指向持久化目录。本地示例为 `.data/pi`；Docker 中固定为
`/app/data/pi`，由 `agent-runtime-data` 命名卷保存。不能把该目录放到容器临时层，也不能在
重新部署时删除该卷。

SQLite 运行状态由单个写入进程持有。服务通过 PostgreSQL 所有权锁防止同一运行存储被多个
实例同时驱动；新增服务实例前必须设计明确的会话路由与所有权转移，不能让多个副本直接打开
同一组 SQLite 文件。模型访问失败与存储失败分别处理。运行期间的存储失败或所有权连接丢失
会关闭失效的 Harness，取消其中的模型工作并释放连接。业务任务运行器自动重新获取所有权、
打开 SQLite、核对持久化任务后恢复；失败重试从 100 毫秒指数退避到最多 10 秒。正常关闭服务
会取消等待中的重试并释放运行资源。首次启动的迁移错误或缺失快照仍然使启动失败，不能用
后台重试掩盖损坏数据。

备份与恢复：

1. 停止 server，确保没有运行中的模型或业务写操作。
2. 备份 PostgreSQL，并完整备份 `agent-runtime-data` 卷；SQLite 文件及其 WAL 文件必须一起保存。
3. 恢复时使用同一停机点的数据库和运行卷，确认文件权限与原先一致，再启动 server。
4. 服务重新打开运行状态并恢复未完成任务；等待人工审批的任务继续等待，不默认批准。

单纯复制一个正在写入的 `.sqlite` 主文件不构成一致备份。历史业务记录和当前运行状态都属于
恢复范围，不能只恢复其中一份后声称已恢复全部 Agent 状态。

## 阶段执行与控制

- 每个阶段先读取持久化输入，完成一步业务处理后保存下一阶段及其数据。
- 只重试网络、限流和数据库短暂不可用等瞬时失败。配置缺失、权限错误、取消和额度不足不能反复重试。
- 取消必须到达后端运行实例及模型请求；仅停止浏览器渲染不算取消。
- 已提交的写操作不会因为取消自动回滚。回执需要如实反映已完成与未执行的部分。
- retry 创建有原任务关联的新任务，保留原任务记录。
- branch 从持久化业务快照创建新任务，不覆盖源任务；新分支重新生成自己的审批身份。
- 用户点击确认后，后台校验并持久化授权，再进入执行阶段；不重复确认同一动作。

## 人工审批与幂等

等待审批时，服务端持久化问题、选项、approvalId、业务动作、作用对象和完整的业务快照。
等待状态可以跨页面关闭和服务重启存在，不能依赖原 HTTP 请求或悬挂的内存回调。
此时 pi 的分析任务已经结束，业务任务保持等待审批；确认后从保存的快照创建执行阶段的后续
pi 任务。等待用户期间没有占用中的模型调用，也没有一直挂起的 pi 调用栈。

恢复接口使用当前认证的管理员身份，核对 approvalId、动作和对象；执行 payload 取自服务端
已保存的审批记录，不采用浏览器提交的替代 payload。确认卡片只展示业务对象、动作、影响范围
和结果，不展示原始 resume payload、内部工作流名称或 checkpoint。

写操作通过 action execution / decision effect 记录去重：

- `SUCCEEDED` 结果复用，不再次执行已经成功的同一业务动作。
- `RUNNING` 的有效租约阻止并发写入；过期后可以恢复重领。
- 写入与成功回执之间发生崩溃时，根据领域对象和幂等身份恢复，不能仅根据工具是否返回判断。
- 未知资源、伪造 finding ID 和不匹配的审批必须在服务端拒绝。

评论分析是只读能力：分析完成后保存建议并展示卡片，不自动隐藏评论。隐藏与恢复由明确的
管理员操作触发，部分失败分别报告成功和失败数量。

## 多任务编排

`multi_task_orchestration` 将一个意图规划成多个业务子处理。规划不直接写业务数据，各子处理
继续遵守各自的审批规则。子任务使用 deterministic dedupeKey，恢复或重放时复用已经存在的任务。

聚合时只统计 `parentRunRelation = CHILD_TASK`，不能把 branch / retry 当作独立业务子结果。
公开 API 使用 `relation=child|branch|retry`；内部运行枚举不成为前端协议。`childTaskKey`
是稳定关联键，子 run 创建前失败时 `runId = null`。单个子任务失败不丢失其他子任务的结果。

## 历史任务切换

Prisma 中已经提交的 checkpoint migration 保持不变，历史 checkpoint 表不删除。当前服务不再
依赖旧执行库；`pi-legacy-workflow-import.ts` 只读取其受限的 JSON 业务状态与线性调度信息。

切换前必须停止旧 server，避免旧服务与新服务并发修改同一批业务任务。启动时对没有
`metadata.engine = "pi"` 标记的 `PENDING`、`RUNNING`、`WAITING_FOR_APPROVAL` 任务检查最新
checkpoint，加载相应版本的 channel blob，并合并已保存的节点结果。导入成功后在同一持久化
提交中保存 pi 状态和 run ID 索引。重复启动用该索引排除已导入任务，不再依赖旧 checkpoint
继续存在；新创建的业务任务使用 `metadata.engine = "pi"` 标记。

- 等待审批的任务保留原问题和业务范围，审批不会被当作默认授权。
- 尚未执行第一步的 `PENDING` 任务可以从已保存的输入启动。
- 缺失 checkpoint、未知序列化格式、构造器、并发图结构或不匹配的 run ID 必须让迁移失败，
  保留原数据，并要求恢复备份或用旧版本完成该任务；不能静默重新分析或丢弃执行状态。
- 自定义旧 checkpoint schema 通过 `PI_AGENT_LEGACY_CHECKPOINT_SCHEMA` 指定，默认 `public`。
  该设置仅供历史读取，不再创建或升级旧表。
- 旧的已完成、失败或取消任务和会话消息继续通过原业务记录查询，不需要重新执行。

## 审计与验证

审计页展示业务活动，不作为运行时调试控制台。管理员触发的生命周期动作继续记录：
`ADMIN_AGENT_TASK_STARTED`、`ADMIN_AGENT_TASK_CONTROLLED`、`ADMIN_AGENT_TASK_RESUMED`。
自动创建的子任务通过父任务关系追踪，不能冒充管理员操作。

每次变更至少验证：

- `vp check`、`vp test`、server 与 admin 的类型检查和构建。
- 真实 pi Harness 的工具循环、消息顺序、A2UI 更新和历史消息恢复。
- SQLite 关闭重开、运行中断恢复、审批前后重启、重复提交和取消传播。
- 成功写入后崩溃的幂等恢复，以及过期 action execution 租约恢复。
- 多任务子任务去重、分支隔离和单任务失败隔离。
- 历史 checkpoint 导入的成功路径、损坏数据和未知格式的失败路径。
- 用户界面不泄漏内部运行标识、阶段名、原始 payload 或调试状态。

真实 PostgreSQL 所有权与历史迁移测试通过 `PI_AGENT_POSTGRES_TEST_URL` 指向专用测试数据库
运行；测试只创建并清理随机命名的 schema，不使用生产数据库。该测试会终止它自己创建的
所有权连接，以验证运行中取消和重新获取所有权后的恢复。
