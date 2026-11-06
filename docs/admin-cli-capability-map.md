# 后台 CLI 功能映射与验收范围

本文按当前后台页面、`apps/admin/src/lib/admin-api.ts`、助手客户端和共享 HTTP 契约盘点能力，供全管理员 CLI 实现与验收逐项核对。表中命令是需求名称；是否已经交付，以 CLI 的帮助、实现和测试为准。本文不代表已经执行线上写入验收。

## 授权约定

- 新的默认登录申请 `admin:read admin:write`；`--read-only` 申请 `admin:read`。
- `admin:read` 覆盖全部后台读取，包括草稿、隐藏或已删除的互动记录、站点配置、审计和本人助手会话。
- `admin:write` 覆盖后台修改，包括上传图片、永久删除文章与分类标签、互动审核、站点设置和助手运行/审批。OAuth 同意页必须明确显示这些能力。
- 原有 `articles:read` / `articles:write` 保持兼容，不因本次扩展自动获得全管理员权限。旧文章写权限不包含永久删除、图片上传、分类标签维护或其他模块。
- 浏览器 Cookie 会话与 CLI Bearer 凭据保持分离。设备授权的允许/拒绝仍要求浏览器管理员会话和受信 Origin，不能让 CLI 凭据自行批准新的设备授权。
- 每次 HTTP 请求和每次助手工具执行前复核主体、权限、撤销与有效期；助手会话只能由其所属管理员访问。

## 菜单与页面清单

| 页面                                         | 后台交互                                                                                                   | CLI 对应范围                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/` 运营工作台                               | 刷新文章总数、草稿数、隐藏评论数、已删除留言数、近期文章和审计；跳转写文章                                 | 汇总命令，复用各列表接口                                                    |
| `/articles` 文章列表                         | 关键词、状态、原创/转载过滤、分页；查看本页统计；新建/编辑/前台阅读                                        | 文章列表、详情、创建、更新、发布                                            |
| `/articles/new`、`/articles/$articleId/edit` | 标题、摘要、Markdown、状态、分类、最多五个标签、封面、原创/转载来源；保存/发布/归档/删除；云草稿保存与恢复 | 文章写入、永久删除、云草稿命令；Markdown 文件/标准输入                      |
| 同一编辑器的图片交互                         | 文件选择、粘贴/拖入图片；上传后在光标或选择范围插入 Markdown，替代文字来自文件名                           | 图片上传返回 URL 和可嵌入 Markdown；由 Agent 放入正文后保存文章             |
| `/articles/categories`                       | 搜索、分页、新建、编辑、永久删除分类                                                                       | 分类列表与 CRUD                                                             |
| `/articles/tags`                             | 搜索、分页、新建、编辑、永久删除、合并到目标标签                                                           | 标签列表、CRUD、合并                                                        |
| `/comments`                                  | 关键词/状态/指定评论定位、分页、文章和父回复上下文；隐藏/恢复                                              | 评论列表、状态更新                                                          |
| `/guestbook`                                 | 关键词/状态、分页；显示/隐藏、软删除/恢复、置顶/取消置顶                                                   | 留言列表与状态/置顶更新                                                     |
| `/site`                                      | 首页文案与按钮、导航和社交链接增删/编辑/排序/启停；保存；公告内容编辑、排序和启停                          | 站点读取、完整设置替换、公告更新                                            |
| `/audit`                                     | 关键词、动作、操作者筛选、分页、展开元数据、跳转相关对象                                                   | 审计列表与完整元数据                                                        |
| `/assistant`                                 | 能力查询、新建会话、恢复本人会话、加载更早记录、提问、流式结果、重试原请求、停止、评论操作预览及允许/拒绝  | 助手能力、会话、历史、运行、状态、停止、审批                                |
| `/oauth/device`                              | 输入/核对短码、显示账号和权限、明确允许或拒绝                                                              | `auth login` 的浏览器确认，不增加自动批准命令                               |
| 通用导航/编辑器本地状态                      | 主题、侧边栏、输入焦点、分栏/纯编辑/预览、滚动、离线提示、浏览器本机草稿                                   | 不添加远程接口；CLI 使用本地文件与服务器云草稿，不能读取浏览器 localStorage |

## 命令需求与 HTTP 映射

`A` 表示 `/api/admin`，`S` 表示 `/api/admin/assistant`。`<id>` 均为服务器资源标识，不能用 URL 或客户端字段替换管理员身份。修改命令可用 JSON 文件或标准输入承载完整契约；列表保留服务端分页。

### 身份、汇总和文章

| 命令需求                                       | HTTP / 数据                                       | 必须保留的行为                                                                 |
| ---------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `auth login [--read-only] [--no-browser]`      | OAuth device grant；默认全后台读写                | SSH/无浏览器可用；显示验证地址和短码，凭据保留在运行 CLI 的机器；不输出 token  |
| `auth status`                                  | `GET /api/oauth/me`                               | 返回真实账号、角色、scope 和到期时间                                           |
| `auth whoami`                                  | `GET A/auth/me`                                   | 读取当前管理员身份；CLI Bearer 仍不得成为浏览器 Cookie 会话                    |
| `auth logout`                                  | `POST /api/oauth/revoke`                          | 服务器撤销后删除本地凭据；不能只清文件冒称撤销成功                             |
| `dashboard get`                                | 组合文章、评论、留言、审计列表                    | 明确汇总口径；加载失败不能当成 0；不要求新增 dashboard API                     |
| `articles list`                                | `GET A/articles`；`q,status,origin,page,pageSize` | `status=ALL/DRAFT/PUBLISHED/ARCHIVED`，`origin=ALL/ORIGINAL/REPOSTED`          |
| `articles get <id>`                            | `GET A/articles/:id`                              | 返回 Markdown、元数据、状态和时间，可用于写后核对                              |
| `articles taxonomies`                          | `GET A/articles/taxonomies`                       | 返回可用分类/标签 slug，供写入前选择                                           |
| `articles create`                              | `POST A/articles`                                 | 默认草稿；标题和正文非空；正文支持 UTF-8 文件及标准输入                        |
| `articles update <id>`                         | `PATCH A/articles/:id`                            | 只修改指定字段；支持清空分类/封面/标签；保留未指定状态；修改已发布正文立即生效 |
| `articles publish <id>`                        | 同上，显式 `{status:"PUBLISHED"}`                 | 发布前摘要非空；转载需来源名称及 HTTP(S) URL；不能从一般输入隐式发布           |
| `articles update <id> --status DRAFT/ARCHIVED` | 同上                                              | 草稿撤回和归档状态与前台可见性一致                                             |
| `articles delete <id>`                         | `DELETE A/articles/:id`                           | 文章及关联评论永久删除；明确目标及不可恢复性质，要求显式调用/确认，不自动重试  |

文章完整字段：`title,description,markdown,status,categorySlug,tagSlugs,coverImageUrl,origin,sourceAuthor,sourceName,sourceUrl`。创建/更新继续使用现有服务端校验和审计，不绕过用例直接写库。

### 图片与编辑器草稿

| 命令需求                                                                         | HTTP / 数据                                                               | 必须保留的行为                                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `images upload <file> [--alt <text>]`                                            | `POST A/articles/images`，multipart 字段 `file`                           | 非空、最大 10 MiB，JPEG/PNG/WebP/GIF；发送原文件与对应 MIME，服务器检查内容签名；不生成或改写图片                     |
| `images prepare <markdown-file> --output <new-file> [--assets-root <directory>]` | 解析本地 Markdown 图片，逐一上传后输出新 Markdown 文件                    | 保留源文件，输出不可覆盖既有文件；先校验所有本地图片，才允许第一个远端上传；部分上传失败不重试或误报保存成功          |
| `images prepare ... --dry-run`                                                   | 仅校验和列出本地图片，不上传、不写新 Markdown                             | root 范围内检查真实路径、符号链接和文件类型/大小；远程 URL 保留，不主动下载                                           |
| `articles create/update ... --upload-images [--assets-root <directory>]`         | 上传本地 Markdown 引用并把公网 URL 写入正文，再保存文章                   | 文件输入默认以正文所在目录为图片根；stdin/JSON 需明确 assets-root；不触及根目录外文件；正文写入与图片上传分别报告回执 |
| 上传结果中的 `markdown`                                                          | 复用返回 URL，生成 `![替代文字](URL)`                                     | 返回原始 `key,mimeType,originalName,size,url` 并给出可嵌 Markdown；正确转义替代文字；不把本机路径当公网 URL           |
| 图片写入文章                                                                     | Agent 把上传结果嵌入 Markdown，再 `articles create/update --file/--input` | 上传成功不等于文章保存成功，分别保留回执；图片可作为正文和封面使用                                                    |
| `drafts get [--article-id <id>]`                                                 | `GET A/article-drafts/current?articleId=...`                              | 新文章草稿用 null；只读取当前管理员的云草稿；不存在返回 null                                                          |
| `drafts save --input <file\|->`                                                  | `PUT A/article-drafts/current`                                            | 保留 `articleId,baseArticleUpdatedAt,clientSavedAt,values`；values 是完整编辑器字段，不能把云草稿当已保存文章         |
| `drafts delete [--article-id <id>]`                                              | `DELETE A/article-drafts/current?articleId=...`                           | 删除当前管理员指定云草稿，不删除文章，也不触碰浏览器本机草稿                                                          |

服务器没有图片列表/删除接口。CLI 首版不伪造这两个能力；清理测试上传对象需要单独的存储侧授权与回执。

### 分类与标签

| 命令需求                                      | HTTP / 数据                                           | 必须保留的行为                                                               |
| --------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `categories list`                             | `GET A/article-categories`；`q,page,pageSize`         | 返回引用数量、描述、名称、slug、ID                                           |
| `categories create`                           | `POST A/article-categories`；`name,slug,description?` | 复用唯一性和长度校验                                                         |
| `categories update <id>`                      | `PATCH A/article-categories/:id`                      | 仅更新提供的字段，描述允许 null                                              |
| `categories delete <id>`                      | `DELETE A/article-categories/:id`                     | 明确永久删除和引用约束；保留服务端失败，不能先在客户端伪装删除               |
| `tags list`                                   | `GET A/article-tags`；`q,page,pageSize`               | 返回引用数、名称、slug 和 ID                                                 |
| `tags create`                                 | `POST A/article-tags`；`name,slug`                    | 拒绝重复 slug                                                                |
| `tags update <id>`                            | `PATCH A/article-tags/:id`                            | 名称/slug 局部更新                                                           |
| `tags delete <id>`                            | `DELETE A/article-tags/:id`                           | 永久删除，显式目标；不自动重试                                               |
| `tags merge <source-id> --target <target-id>` | `POST A/article-tags/:source/merge`；`{targetTagId}`  | 预览源与目标；引用迁移到目标后删除源；不能把相同标签当有效合并或产生重复关联 |

### 评论、留言、配置和审计

| 命令需求                                       | HTTP / 数据                                                             | 必须保留的行为                                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `comments list`                                | `GET A/comments`；`commentId,q,status,page,pageSize`                    | 返回文章、作者、父回复、正文、状态、点赞/回复数；支持定位待审核评论                                |
| `comments update <id> --status VISIBLE/HIDDEN` | `PATCH A/comments/:id`；`{status}`                                      | 修改前明确预览与人工决定；读后写核对，不能编辑正文、伪造作者或永久删评论                           |
| `guestbook list`                               | `GET A/guestbook/messages`；`q,status,page,pageSize`                    | 状态 `ALL/VISIBLE/HIDDEN/DELETED`，保留访客/GitHub 作者及置顶信息                                  |
| `guestbook update <id>`                        | `PATCH A/guestbook/messages/:id`；`{status?,isPinned?}`                 | 显示/隐藏、软删/恢复、置顶/取消置顶；`false` 不能因参数省略而丢失                                  |
| `site get`                                     | `GET A/site-config`                                                     | 返回首页、导航、社交链接和包含禁用项的全部公告                                                     |
| `site update --input <file\|->`                | `PUT A/site-config/settings`；完整 `{home,navigationItems,socialLinks}` | 先读后改完整设置；导航/社交链接增加、移除、排序和启停均在数组中表达；不是局部 PATCH                |
| `announcements list`                           | 从 `site get` 的 `announcements` 获取                                   | 不要求新列表 API；包含 key、启停、排序及全部展示字段                                               |
| `announcements update <id>`                    | `PATCH A/site-config/announcements/:id`                                 | 支持 `title,icon,iconClassName,process,status,command,output,isEnabled,sortOrder`，保留 false 和 0 |
| `audit list`                                   | `GET A/audit/logs`；`q,actorLogin,action,page,pageSize`                 | 返回服务器审计身份、资源、摘要、metadata、IP、userAgent、时间；无审计创建/删除命令                 |

公告当前只有编辑/启停入口，没有创建或删除 API；首页、导航、社交链接也没有独立资源 CRUD 接口。CLI 用现有设置契约表达操作，不新增平行数据模型。

### 助手

| 命令需求                                                                   | HTTP / 数据                                                              | 必须保留的行为                                                                                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assistant capabilities`                                                   | `GET S/capabilities`                                                     | enabled、工具名称/说明/readOnly；关闭时如实报告，不伪装成功                                                                                                                                 |
| `assistant create`                                                         | `POST S/conversations`                                                   | 返回服务器会话 ID；只能以真实管理员主体创建                                                                                                                                                 |
| `assistant history <conversation-id> [--before <turn-id>] [--limit n]`     | `GET S/conversations/:id`；`before,limit`                                | `limit` 1–100，`before` 为服务器 turn UUID；返回 `conversation,turns,nextBefore`                                                                                                            |
| `assistant turn <conversation-id> <request-id>`                            | `GET S/conversations/:id/turns/:requestId`                               | 核对持久化状态、消息、工具结果、错误与 actions；恢复未知结果时使用原 requestId                                                                                                              |
| `assistant run <conversation-id> --request-id <id> --message/--file ...`   | `POST S/conversations/:id/run`，AG-UI SSE                                | 使用既有 AG-UI SDK；`threadId` 必须等于路径，`runId=requestId`；用户输入非空且最多 2000 字；不能注入工具、身份、客户端状态或历史替代服务器会话                                              |
| 运行的流式输出与结束核对                                                   | `RUN_STARTED`、文本、工具、`RUN_FINISHED/RUN_ERROR`；之后 GET turn       | 默认 stdout 返回最终 JSON，`--events` 将公开进度 JSONL 写到 stderr；不得把 EOF、RUN_FINISHED 或模型文字当业务提交回执；不输出思考、原始供应商消息或 token                                   |
| `assistant stop <conversation-id> <request-id>`                            | `POST S/conversations/:id/turns/:requestId/stop`                         | 返回并复核 `CANCELLING/CANCELLED` 等真实状态；取消后等实际工作收束，不直接声称完成取消                                                                                                      |
| `assistant decide <conversation-id> <action-id> --decision CONFIRM/REJECT` | `POST S/conversations/:id/actions/:actionId/decision`；只传 `{decision}` | 先展示待操作评论、当前/目标状态和所属文章；`--request-id` 可直接定位预览，否则最多查最近 500 turn；显式确认/`--yes` 后才能执行；成功依据 APPLIED + receipt，不另传 actor/commentId/目标状态 |
| 未知结果恢复                                                               | GET turn/history，必要时同 requestId 或同 actionId + 同 decision 重试    | 不新建业务身份，不启用相反决定，不自动重放写入；CLI 断开也需要核对服务端收束状态                                                                                                            |

当前没有“列出全部会话”或“删除会话”API，也没有 UI 会话目录；CLI 保存/输出已有 conversationId 用于恢复，不能把浏览器本地记录伪装成服务器完整会话列表。后台助手现有工具仍以服务端 capabilities 为准；全管理员 CLI 不意味着模型自动获得新的后台工具。

助手接入必须同时修改工具前的重新鉴权入口：现有 `AssistantController.run` 闭包曾只读取 Cookie session token；仅扩展控制器外层 Guard 会让 Bearer 运行在首次工具前失败。复核还要保留原主体、所需 scope 和撤销状态。

## CLI 模块职责

`commands/admin.ts` 只聚合注册；分类标签在 `taxonomies.ts`，云草稿在 `drafts.ts`，评论/留言治理在 `moderation.ts`，站点与公告在 `site.ts`，工作台汇总与审计在 `operations.ts`。这些模块共同使用 `admin-input.ts` 的参数、UUID、分页与字段读取；不复制鉴权、HTTP、文件读取或确认流程。助手独立在 `assistant.ts`，文章与图片分别在各自命令模块；本地图片处理属于 `content/images.ts`，OAuth 设备授权与凭据持久化属于 `auth`。

## 验收矩阵

| 层级             | 最小有意义的验收                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OAuth 和资源边界 | 默认全管理员读写、只读仅 GET；旧文章 scope 不越权；拒绝 Cookie/Bearer 混用；到期/撤销/管理员白名单失效；所有新增模块经过真实 HTTP Guard                                              |
| CLI 参数与输出   | 每个业务入口至少一个真实子进程请求映射；UTF-8/stdin/JSON；保留 false/0/null/空数组；未知字段、重复参数、危险 ID、权限不足非零退出；不泄漏 token，不跨 origin 转发，不自动重试写入    |
| 文章及图片       | 上传真实小 PNG，断言 multipart 字段/文件字节/MIME/回执；拒绝空、超限、不支持格式及 MIME/签名不符；上传 Markdown 转义；把其 URL 嵌入草稿并读回正文、封面，发布后再核对实际图片可访问  |
| 草稿和分类标签   | 新文章/指定文章云草稿隔离；原用户与他人记录隔离；分类/标签创建更新及约束失败；合并真实迁移且无重复关联；删除仅针对隔离测试资源                                                       |
| 互动治理         | 评论预览后明确决定；留言 hidden/deleted/visible 与 pin true/false；服务端状态、审计及公开可见性核对；不会改写正文或作者                                                              |
| 站点及审计       | 从初始设置复制后局部调整 JSON，再完整 PUT；验证导航/社交链接 false/0 和公告启停/排序；审计动作、主体、资源 ID 准确；结束恢复原配置并核对                                             |
| 助手生命周期     | 使用真实 SDK 配可控上游，核对流开始/文本/工具/结束与最终 turn；原 requestId 重试无重复业务效果；stop 后最终状态；工具前 Bearer 撤销终止；审批人工决定及同身份恢复；禁止他人会话/审批 |
| 同意页           | 四种 scope 清晰说明；全管理员写授权显示删除、上传、审核、设置、助手与审批；只读不宣称可写；旧文章授权描述保持准确；未知 scope 阻止授权；加载/拒绝/回包丢失只允许原决定重试           |

先用独立数据库与可控外部存储/模型完成验收。线上完整写入验收需要具体资源、可逆变更和清理方案的明确授权；本文不启动线上上传、删除、审核、配置修改或模型运行。现有第一版文章 CLI 的线上证据只证明当时的文章范围，不能外推为本次全管理员版本已验收。
