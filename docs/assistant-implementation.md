# 管理助手实现与运维

本实现采用 Pi 1.5.0 的 agent-core 与 ai、AG-UI 1.0.4、自有 React 界面和 PostgreSQL。开放范围是审计查询、评论搜索，以及单条评论状态修改的预览和人工确认。没有通用工作流、自动治理、后台续跑或 Pi 专用运行卷。

技术取舍见 [重建方案](./agent-rebuild-plan.md)，真实浏览器联调见 [浏览器记录](./assistant-browser-verification.md)，真实模型结果见 [固定评测报告](./assistant-evaluation-results.json)。模型评测的历史失败尝试也保留在报告中；不能用单元测试或浏览器模拟上游结果代替该门槛。

## 开关与入口

`ASSISTANT_ENABLED`、`ASSISTANT_ACTIONS_ENABLED` 默认均为 `false`。

- 总开关开启且模型配置完整时，管理员导航显示“管理助手”，路径为 `/assistant`。
- 只读模式只开放 `list_audit_logs` 和 `search_comments`。
- 操作开关同时开启后才注册 `prepare_comment_moderation`，并允许确认操作。
- 关闭总开关后拒绝新执行和确认；历史、状态、停止与拒绝仍可使用。
- 修改 Compose 环境配置后须重新创建 server；本版本不提供绕过运维权限的在线开关接口。

权限沿用 GitHub 登录会话与管理员白名单。每次工具执行前重新检查登录状态和请求状态；工具参数、客户端历史及会话标识均不能替换执行者身份。能力标签由实际注册工具派生。

## 数据与状态

新迁移增加 AssistantConversation、AssistantTurn、AssistantAction 三张表，以及评论的 moderationVersion。此前删除的 Agent 表和数据不会恢复。

PostgreSQL 保存会话及版本化 canonical 消息。API 只投影公开文本、结构化结果和操作回执；供应商继续对话所需的内部消息元数据不直接公开。消息和工具身份包含内部 Turn ID 与消息位置，不单独依赖供应商返回的 `call_1`。

同会话的 requestId 唯一；相同身份及输入只读已有记录，修改输入返回冲突。活动请求部分唯一索引覆盖 RUNNING 与 CANCELLING。完成和取消使用条件更新，迟到 Stop 不会覆写已完成结果。

本版本按单 API 实例部署。启动时将失去执行者的 RUNNING 标记为中断，将已有停止意图的 CANCELLING 标记为取消；不恢复旧模型或工具执行。增加副本之前须另行设计执行所有权。

HTTP 断线取消模型与后续调度，显式停止仅作用于指定请求。底层数据库查询实际结束前不会宣称停止完成。助手的审计及评论查询每条 SQL 最长 5 秒，整个查询事务最长 11 秒；普通管理页查询不使用这项助手专属设置。

默认模型与工具调度预算 60 秒，到时停止新调用并完成必要的取消与存储收束，不把超时瞬间当作所有数据库工作已结束。最多 6 次模型调用、8 次工具调用，用户输入最多 2000 字符、公开回复最多 12000 字符，单次工具结果最多 24000 字节。输入预算最多 24000 token，并受模型上下文窗口减输出预算约束。超过预算明确失败，不静默改写筛选或截断 JSON 结果。

模型参考完整的已完成交互组。历史超过当前上下文边界时提示新建会话；完整保存记录仍可分页查看，不进行自动摘要压缩。

## 操作确认

预览只保存待确认动作，不修改评论。用户点击卡片后，服务端重新鉴权并检查归属，优先返回已提交回执；只有尚未执行的动作才校验目标版本。

确认时锁定动作，以评论 moderationVersion 作条件更新，在同一 PostgreSQL 事务内提交评论状态、普通业务审计和成功回执。普通评论管理入口也复用该原子命令。双击、并发确认和提交后丢回包不会重复产生效果。

Action 的 currentStatus 是预览时的快照，receipt 是历史已提交效果，不是评论此刻状态的镜像。后续人工更改不会篡改旧回执；查询当前状态应重新搜索评论。对话里的“同意”不能代替卡片确认。

## 接口

所有接口均位于 `/api/admin/assistant` 并要求管理员登录。

| 方法与相对路径                                       | 用途                                |
| ---------------------------------------------------- | ----------------------------------- |
| GET `/capabilities`                                  | 实际可用工具及总开关状态            |
| POST `/conversations`                                | 创建所属当前管理员的会话            |
| GET `/conversations/:id`                             | 分页历史；支持 limit 和 before 游标 |
| POST `/conversations/:id/run`                        | 原生 AG-UI 输入与 SSE 输出          |
| GET `/conversations/:id/turns/:requestId`            | 查询已保存请求及回执                |
| POST `/conversations/:id/turns/:requestId/stop`      | 请求停止                            |
| POST `/conversations/:id/actions/:actionId/decision` | 仅接受 CONFIRM 或 REJECT 决定       |

执行接口接受原生 `protocolVersion: "1.0"`；threadId 必须匹配路径，runId 为会话内请求身份。只采用最新用户消息，可信历史从数据库读取，拒绝非空客户端 tools、context、state 和 forwardedProps。

正常结束后才发送 RUN_FINISHED；取消或失败发送对应 RUN_ERROR。工具参数结束不代表业务成功。前端在流结束、断线或停止后读取 canonical 状态，不把 EOF 或模型文字当作成功回执。

## 验证方式

本轮本地门禁为 `vp check`、287 项单元及模块测试、server/admin/website 构建，以及 10 项真实 PostgreSQL 持久化与 HTTP 测试、6 项数据库锁等待超时测试。真实 Chrome 跨 origin Cookie 与完整接口联调已通过。

MiniMax-M3 固定评测完成 20 个用例各 3 次，原始评分 57/60；其中正向为 47/48（97.9%），关键错域、越权、伪造和泄漏计数为 0，基础审计查询 3/3。两条已提供类型化安全拒绝的结果被文字关键词检测误判，另列复核，不覆盖原始记录；复核后负向 12/12，方案门槛满足。剩余一条首次可选参数占位错误被服务端拒绝后自动修正，保守计为正向失败。报告也保留首轮未完成及失败数据，不宣称 60/60 自动通过。

上述结果是固定样本验证，不是任意自然语言请求的正确率保证。线上发布另做真实认证和只读查询验证，不在生产执行评论修改来证明审批功能。

```bash
vp install -- --registry=https://registry.npmjs.org
vp run db:generate
vp check
vp test
vp run -F @adrian-zephyr-notes/server build
vp run -F @adrian-zephyr-notes/admin build
```

真实数据库测试必须指向已迁移的独立数据库。持久化与 HTTP 测试会模拟单实例启动的活动请求收束，不能对同一数据库并发执行这两个测试文件，更不能使用生产数据库。

```bash
cd apps/server
ASSISTANT_TEST_DATABASE_URL=postgresql://test:test@localhost:5432/assistant_test \
  vp test --config vitest.e2e.config.ts --no-file-parallelism \
  test/assistant-persistence.e2e-spec.ts test/assistant-http.e2e-spec.ts
```

SQL 超时测试使用独立的锁等待场景，也通过 `ASSISTANT_TEST_DATABASE_URL` 指向专用测试数据库。真实模型评测脚本 `apps/server/scripts/evaluate-assistant.mjs` 自建并删除临时 PostgreSQL 数据库，只读取本地模型配置，不读取生产业务数据。它会产生付费模型调用；计划检查可使用 `--plan-only`，单次预检可使用 `--preflight-only`。

## 保存与删除

本版本不自动过期删除会话；数据保留到管理员要求维护删除。运维删除必须明确 ownerUserId 和 conversationId，先停止该会话的活动请求，再按所属关系删除 AssistantConversation，利用外键级联删除其 Turn 与 Action。不得用全表清空代替指定会话删除。

已提交的评论状态及普通业务审计不会随会话删除而回滚或删除。旧 Action ID 删除后不再可确认。会话数据包含在 PostgreSQL 备份中；删除活动库记录不会自动清除历史备份，备份的保留或清除须按同一删除要求单独核对。

运行日志仅收集必要关联 ID、状态和错误类别，不打印 Cookie、密钥、连接串、完整提示词、思考正文或原始工具结果。

## 发布与回退

先完成真实模型门槛，再启用相应工具。保留发布前数据库备份、现用镜像及生产专属配置，构建完成后再切换服务。本实现没有 SQLite 备份、目录挂载或 Pi 运行卷步骤。

server 镜像先按源锁文件安装并编译，再用 pnpm 10.13.1 的冻结部署路径生成独立生产依赖。部署阶段仅调整 builder 内的注入设置，保留包版本快照，并以 `--offline` 使用前一步的缓存；缺包直接失败，不在裁剪生产依赖时重新联网解析版本。工作区配置和提交的锁文件不因此改动，参见 [pnpm deploy 说明](https://pnpm.io/10.x/cli/deploy)。

Docker 上下文排除所有层级的实际环境配置，仅保留 example；server 在 builder 和最终镜像中分别检查关键配置路径，防止配置随构建或运行文件打包。

回退先关闭两个助手开关，停止活动请求并停掉 server，在数据库备份后废弃所有待确认动作，再启动旧镜像。旧版本普通评论入口不会递增 moderationVersion；如果保留 PENDING 动作，退版期间的人工修改可能无法被再次升级后的版本检查识别。维护时可在服务已停止的前提下执行以下语句，使旧卡片失效；不修改已提交回执和评论状态：

```sql
UPDATE assistant_actions
SET status = 'REJECTED', decided_at = CURRENT_TIMESTAMP
WHERE status = 'PENDING';
```

保留执行时间、影响行数及发布前备份作为回退记录。迁移是增量新增，旧应用不会因新表存在而自动恢复助手；业务写入发生后按真实审计和回执做前向处理，不能把回退代码当作撤销已确认操作。
