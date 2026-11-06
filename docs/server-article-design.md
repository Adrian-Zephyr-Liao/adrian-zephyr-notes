# 网站服务端文章模块

文章模块已经提供公开读取、管理员文章维护、分类标签、编辑暂存、图片上传和 AI 摘要。
运行时文章来自 PostgreSQL；网站不再使用本地静态文章集。本文说明仓库中的实现边界，
不表示这些代码已经部署；生产版本与验收范围以对应发布记录为准。

## 分层与数据

`apps/server/src/articles` 按以下职责组织：

- `domain`：文章、摘要和值对象，以及文章、分类、标签、编辑暂存、图片存储等仓库或外部能力端口。
- `application`：公开查询、管理员维护、阅读指标、图片校验与上传、摘要排队及生成用例。
- `infrastructure`：Prisma 仓库、公开与管理端响应映射、模型和 OSS 适配。
- `presentation`：HTTP 控制器、DTO、权限接入和错误映射。

控制器不直接访问 Prisma。领域类型不作为公开 HTTP 契约，Markdown 的 HTML 渲染由
`packages/markdown` 承担，服务端存储和返回 Markdown 正文。

数据库字段、关系和索引以 [Prisma schema](../apps/server/prisma/schema.prisma) 与提交的
[migrations](../apps/server/prisma/migrations) 为准，包含文章、修订、分类标签、摘要和编辑暂存。
不在本文维护另一份表结构或未实现的文件树。

## 公开读取

[ArticlesController](../apps/server/src/articles/presentation/articles.controller.ts) 提供：

| 路径                                 | 用途                               |
| ------------------------------------ | ---------------------------------- |
| `GET /api/articles`                  | 已发布文章列表、搜索和分类标签筛选 |
| `GET /api/articles/:slug`            | 已发布文章详情，含正文与可用摘要   |
| `GET /api/articles/categories`       | 有公开文章的分类及数量             |
| `GET /api/articles/categories/:slug` | 公开分类详情                       |
| `GET /api/articles/tags`             | 有公开文章的标签分页列表           |
| `GET /api/articles/tags/:slug`       | 公开标签详情                       |

列表仅返回状态为 `PUBLISHED` 且 `publishedAt` 不晚于查询时间的文章。
`page` 默认 1，文章列表 `pageSize` 默认 10、最大 50；标签列表默认每页 24、最大 50。
`category` 和 `tag` 使用 slug，`q` 已实现对标题、摘要和 Markdown 正文的不区分大小写包含查询。
HTTP 查询参数由 [DTO](../apps/server/src/articles/presentation/dto/article-list-query.dto.ts) 校验，
无效分页返回 400；不存在或不公开的文章、分类和标签返回 404。

响应字段直接参考 [文章 HTTP 契约](../packages/contracts/src/public/articles.ts)，分页参考
[分页契约](../packages/contracts/src/public/pagination.ts)。详情还包含原创/转载来源、标签和摘要；
不要依赖旧示例中缺少字段的 JSON。

公开详情读取会在摘要缺失或过期时尝试排队并生成摘要，可能写入摘要状态并调用配置的模型；
它不是无副作用的后台查询。具体流程见
[GetPublishedArticleBySlugUseCase](../apps/server/src/articles/application/get-published-article-by-slug.use-case.ts)。

## 管理、评论与认证

管理员文章、分类标签、编辑暂存和图片接口位于 `/api/admin`，通过
[AdminApiAccessGuard](../apps/server/src/oauth/presentation/admin-api-access.guard.ts)
接入管理员 Cookie 会话或带作用域的 CLI Bearer 凭据。各接口声明自己的 scope；旧
`articles:read` / `articles:write` 不自动获得图片上传、永久删除或其他全管理员能力。
完整命令与接口映射见 [管理员能力表](./admin-cli-capability-map.md)，图片边界见
[图片上传](./admin-article-image-upload.md)。

评论属于独立的 `comments` 上下文。`GET /api/articles/:slug/comments` 按顶层评论分页，
默认每页 20、最大 50，回复随其所属顶层评论返回；`POST` 在同一路径创建评论或回复，
要求 GitHub 用户会话。字段包含点赞状态，参考
[评论契约](../packages/contracts/src/public/comments.ts)。

`GET /api/auth/me` 返回 `{ user: AuthUserResponse | null }`；`POST /api/auth/logout`
撤销会话并返回 204。开发时网站同源 API 路由代理至 NestJS；生产 Caddy 直接转发 `/api/*`
到 NestJS。OAuth 回调与 Cookie 配置需按真实访问域名验证，不能用本地代理成功代替生产验收。

## 配置、验证与发布

从仓库根目录的 [`.env.example`](../.env.example) 开始配置。
原生 Nest 进程读取 `PORT`，默认 3001；开发 Compose 中的 `SERVER_PORT` 只决定宿主机端口映射，
`POSTGRES_HOST_PORT` 决定 PostgreSQL 的宿主机映射端口。容器内数据库端口仍是 5432。
网站的 `BACKEND_API_BASE_URL` 必须指向它实际能访问的 API 地址，不能混用宿主机和容器网络地址。
真实凭据只放在忽略的环境文件或部署配置中。

启动与检查命令见 [Server README](../apps/server/README.md)。数据库回归只允许显式配置的
一次性测试数据库，不能连接生产库；普通单元测试不代表真实 SQL 或 HTTP 边界已经验收。
生产使用 [预构建镜像发布流程](./deployment/prebuilt-releases.md)，不在生产安装依赖或构建镜像。
API 当前采用单实例助手执行边界，包含 API 的发布必须安排明确维护窗口；前端候选切流不能直接套用于 API。
