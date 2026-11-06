# Assistant 浏览器 P0 联调记录

验证时间：2026-11-06，Asia/Shanghai。本轮未提交工作区，接口协议字段修复后重新构建并验证。

## 环境与边界

- 使用本机 Google Chrome **156.0.8078.81**，Playwright 独立临时安装在 `/tmp/azn-assistant-browser.6SXRuX`，未加入产品依赖。
- 浏览器运行真实 admin Vite 页面，连接编译后的 `apps/server/dist/main.js` 和 PostgreSQL 17。
- 前端 `admin.assistant.localhost` 与后端 `api.assistant.localhost` 使用不同 origin；浏览器通过 `credentials: include`、真实 HttpOnly cookie 和后端 CORS 鉴权。没有使用浏览器请求拦截或 route mock。
- 在共享测试容器中另外建立 `assistant_browser_test`，完整应用 34 条迁移。所有管理员、15 分钟测试 session、文章、评论、会话、操作和审计记录均为本次新建的隔离数据。
- 模型上游是本地可控 SSE 服务，通过 Pi 官方 OpenAI-compatible adapter 调用。它根据测试输入返回固定工具调用，用于验证传输、原生工具循环和界面集成；本记录不代表真实模型理解或准确率评测，也不覆盖第三方 GitHub OAuth 跳转登录。
- 未读取已有 session 或模型密钥，未访问生产，未改写真实业务内容。

## 结果

| 场景                 | 浏览器操作及实际核对                                                                                                       | 结果 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---- |
| 未登录门禁           | 打开 `/assistant`，显示 GitHub 登录入口，未展示输入框                                                                      | 通过 |
| 已登录身份与能力入口 | 新建测试 session 的 HttpOnly cookie；真实 `/auth/me` 返回测试管理员；助手导航及三个服务端能力可见                          | 通过 |
| Cookie 与 CORS       | 跨 origin 的浏览器请求成功；网络响应的 Allow-Origin 精确匹配前端，Allow-Credentials 为 true；页面脚本读不到 session cookie | 通过 |
| 审计对话             | 点击发送后经真实 Nest/Pi/PG 查询；显示固定审计卡片；私有审计 metadata、IP、UA 未出现在页面及模型工具结果中                 | 通过 |
| 消息身份与刷新       | SSE 文本 messageId 均存在于保存的 PG 投影；刷新后的 messages 与刷新前完全相同，上游调用次数未增加                          | 通过 |
| 停止                 | 页面先显示上游分段正文；点击停止；PG 最终为 CANCELLED，真实 SSE 上游连接关闭，可继续发送新问题                             | 通过 |
| 评论搜索             | 调用真实查询用例，显示隔离评论及固定结果卡片，历史中的工具名为 search_comments                                             | 通过 |
| 单条操作预览         | 显示等待确认卡片；直接检查 PG，评论仍为 VISIBLE，没有提前写入隐藏状态                                                      | 通过 |
| 确认与幂等           | 点击一次确认隐藏，PG 为 HIDDEN；相同确认再请求返回同一已保存回执；COMMENT_STATUS_UPDATED 审计记录恰好一条                  | 通过 |
| 已执行回执刷新       | 刷新后仍显示已执行及已保存的审计回执                                                                                       | 通过 |
| 拒绝                 | 新建恢复预览并点击拒绝；Action 为 REJECTED，评论仍为 HIDDEN，状态变更审计数量仍为一条                                      | 通过 |
| 控制台及网络         | 鉴权后应用 console error、未捕获 page error、request failure 均为 0                                                        | 通过 |

最终可控上游请求数为 **9**，主动停止造成的上游断开数为 **1**。五个保存的 turn 依次为 COMPLETED、CANCELLED、COMPLETED、COMPLETED、COMPLETED；两个 Action 分别为 APPLIED、REJECTED。

## 本次发现并修复的集成问题

真实 `@ag-ui/client@1.0.4` 的 HttpAgent 会在请求体加入 `protocolVersion: "1.0"`。原服务端输入白名单没有该字段，因此浏览器首次发送得到 400，上游调用数为 0。此前手工构造的 HTTP 请求未包含该字段，不能覆盖这个 SDK 集成差异。

服务端随后接受可选的原生 `PROTOCOL_VERSION` 并严格校验其值，增加回归，再构建后完成上述全部浏览器验证。

## 发送到上游的指令核对

只检查本地 SSE 服务实际收到的 JSON 并记录布尔值，不保存或输出完整 prompt。以下五项均为 true：

- 审计工具不支持日期筛选的限制已发送。
- 不得取一页后声称检索全部的指令已发送。
- 最新用户请求决定当前任务的指令已发送。
- 历史消息和工具数据仅为背景的边界已发送。
- 忽略评论、标题及审计摘要内指令的规则已发送。

因此，本次集成中系统指令没有在浏览器、应用层或 provider adapter 之间丢失；这并不证明真实模型一定遵守这些指令。

## 本地证据与清理

临时目录：`/tmp/azn-assistant-browser.6SXRuX`。该目录为本机临时证据，不随 Git 发布，包含：

- `browser-verification.cjs`：实际浏览器驱动和隔离 fixture 脚本。
- `evidence.json`：最终通过结果、计数、指令布尔检查和清理结果；不含 cookie 或密钥。
- `00-sdk-protocol-rejection.png`、`protocol-failure.json`：修复前 SDK 字段不兼容的证据。
- `01-login-gate.png`：未登录门禁。
- `02-audit-completed.png`：审计结果及完成记录。
- `03-stopped.png`：停止后的保存记录。
- `04-preview-pending.png`：待确认预览。
- `05-confirmed-receipt.png`：已执行及审计回执。
- `06-rejected-restore.png`：拒绝恢复的记录。

已打开检查审计、确认回执和拒绝截图。验证脚本通过 finally 关闭自有 Chrome、Nest、Vite 和 SSE 服务，断开 Prisma 后删除整个独立测试数据库，清理结果为 true。共享 PostgreSQL 容器及其他测试数据库保持运行。
