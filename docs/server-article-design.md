# 网站服务端文章模块设计

## 目标

为网站前台提供 PostgreSQL 驱动的文章读取服务，替换前端当前的本地静态文章数据。当前阶段不做管理端，不开放文章写入 API；文章数据可以先通过迁移、种子脚本或后续内部导入流程落库。

成功标准：

- 网站前台首页列表和文章详情页从服务端读取已发布文章。
- 文章详情页支持 GitHub 登录后的公开评论。
- 服务端不走 mock 或内存数据，运行时数据源是 PostgreSQL。
- 文章模块按 DDD 分层，领域规则不泄漏到 Controller 或 ORM 模型里。
- Docker 打包部署时，服务端和 PostgreSQL 可以通过环境变量组合启动。
- PostgreSQL 账号、数据库名和宿主端口已确认；真实密码只写入本地 `.env`，不提交进仓库。

## 当前上下文

- 服务端位于 `apps/server`，当前是 Nest 默认骨架。
- 网站前台位于 `apps/website`，SSR 文章读取通过 `BACKEND_API_BASE_URL` 调用服务端 API。
- 浏览器端登录、退出和评论请求先访问网站同源 `/api/*` 路由，再由 Next.js 代理到服务端，避免浏览器跨域。
- Markdown 渲染能力在 `packages/markdown`，服务端只负责存储和返回 Markdown 内容，不负责 HTML 渲染。
- 先做网站公开读取能力，暂不设计管理端页面和后台写入体验。

## 技术选择

- Runtime: NestJS
- Database: PostgreSQL
- ORM / migration: Prisma
- API style: REST
- Validation: DTO 边界校验，内部应用层信任已验证输入
- Deployment: Dockerfile + Docker Compose
- Shared contracts: `packages/contracts` 保存前后端共享的公开 API 类型

选择 Prisma 的原因：

- 与 NestJS 配合简单，适合先建立清晰 Repository 边界。
- migration、schema 和生成类型集中管理，利于维护。
- 后续如果改为 Drizzle 或直接 SQL，可以把影响限制在 Infrastructure 层。

## DDD 分层

服务端业务模块统一采用 `domain/application/infrastructure/presentation` 分层。当前业务边界：

- `articles`: 文章公开读取上下文。
- `auth`: GitHub 登录、本地 session、当前用户上下文。
- `comments`: 文章评论上下文。
- `database`: 共享基础设施模块，只提供 Prisma 连接，不承载业务规则。

模块结构约定：

```text
articles/
  domain/
    article.entity.ts
    article-status.ts
    article.repository.ts
    value-objects/
      article-id.ts
      article-slug.ts
  application/
    get-published-article-by-slug.use-case.ts
    list-published-articles.use-case.ts
    search-published-articles.use-case.ts
  infrastructure/
    prisma-article.repository.ts
    article-read-model.mapper.ts
  presentation/
    articles.controller.ts
    dto/
      article-detail.response.ts
      article-list-query.dto.ts
      article-list-item.response.ts
  articles.module.ts

auth/
  domain/
    auth-user.entity.ts
    auth-session.repository.ts
    auth-user.repository.ts
    github-oauth-client.ts
  application/
    create-github-authorization.use-case.ts
    complete-github-login.use-case.ts
    get-current-user.use-case.ts
    logout.use-case.ts
  infrastructure/
    github-oauth-client.ts
    prisma-auth-session.repository.ts
    prisma-auth-user.repository.ts
    auth-user.mapper.ts
  presentation/
    auth.controller.ts
    cookie.ts

comments/
  domain/
    article-comment.entity.ts
    article-comment.repository.ts
  application/
    create-article-comment.use-case.ts
    list-visible-article-comments.use-case.ts
    article-comments-pagination.ts
  infrastructure/
    prisma-article-comment.repository.ts
    article-comments.mapper.ts
  presentation/
    article-comments.controller.ts
    dto/
```

边界规则：

- `domain` 不依赖 Nest、Prisma、HTTP。
- `application` 依赖 Repository 接口，不依赖 Prisma 实现。
- `infrastructure` 负责 Prisma 模型和领域模型之间的转换。
- `presentation` 只处理 HTTP、DTO、状态码和错误映射。
- Nest `Module` 负责绑定 use case、repository token 和 infrastructure 实现。
- `AppModule` 只导入模块，不承载业务规则。
- `packages/contracts` 只放 HTTP 契约类型；后端 Domain Entity 和 Prisma 类型不对前端开放。

## 共享类型边界

前后端通过 `packages/contracts` 共享公开 API 类型：

- `ArticleListQuery`
- `ArticleListItemResponse`
- `ArticleListResponse`
- `ArticleDetailResponse`
- `PaginatedResponse`

不共享：

- Prisma 生成类型
- Nest DTO class
- Domain Entity / Value Object
- Repository interface

原因：共享 API 契约可以避免前后端字段漂移；不共享后端内部类型可以保持 DDD 分层和服务端重构自由。

## 领域模型

### Article 聚合

Article 是聚合根，负责维护文章自身一致性。

核心字段：

- `id`: 稳定主键，建议 UUID。
- `slug`: URL 标识，全局唯一，不随标题自动变化。
- `title`: 文章标题。
- `description`: 摘要，用于列表、SEO 和分享卡片。
- `markdown`: Markdown 正文。
- `status`: `DRAFT | PUBLISHED | ARCHIVED`。
- `category`: 可选分类。
- `tags`: 标签集合。
- `coverImageUrl`: 可选封面。
- `wordCount`: 字数，写入时计算并持久化，列表查询不重复计算。
- `readingMinutes`: 阅读时间，写入时计算并持久化。
- `publishedAt`: 发布时间，只有已发布文章可见。
- `createdAt` / `updatedAt`: 审计时间。

领域规则：

- `slug` 必须唯一、稳定、URL safe。
- `title` 不能为空。
- `markdown` 不能为空。
- `PUBLISHED` 文章必须有 `publishedAt`。
- 前台 API 只能返回 `PUBLISHED` 且 `publishedAt <= now()` 的文章。
- `ARCHIVED` 不在前台出现，但保留历史记录。
- 修改正文时应产生 revision 记录，便于后续回滚和审计。

## PostgreSQL 表设计

建议首版表结构：

```text
articles
  id uuid primary key
  slug text not null unique
  title text not null
  description text not null
  markdown text not null
  status text not null
  category_id uuid null references article_categories(id)
  cover_image_url text null
  word_count integer not null
  reading_minutes integer not null
  published_at timestamptz null
  created_at timestamptz not null
  updated_at timestamptz not null

article_categories
  id uuid primary key
  slug text not null unique
  name text not null unique
  description text null
  created_at timestamptz not null
  updated_at timestamptz not null

article_tags
  id uuid primary key
  slug text not null unique
  name text not null unique
  created_at timestamptz not null
  updated_at timestamptz not null

article_tag_links
  article_id uuid not null references articles(id) on delete cascade
  tag_id uuid not null references article_tags(id) on delete cascade
  primary key (article_id, tag_id)

article_revisions
  id uuid primary key
  article_id uuid not null references articles(id) on delete cascade
  title text not null
  description text not null
  markdown text not null
  created_at timestamptz not null
```

索引：

- `articles(status, published_at desc)` 用于前台列表。
- `articles(slug)` 唯一索引用于详情。
- `article_categories(slug)` 唯一索引用于分类筛选。
- `article_tags(slug)` 唯一索引用于标签筛选。
- 后续需要搜索时，再增加 PostgreSQL full-text search 的 `tsvector` 索引。

## API 契约

所有公开 API 只返回已发布文章。

### List Articles

`GET /api/articles`

Query:

- `page`: 默认 `1`
- `pageSize`: 默认 `10`，最大 `50`
- `category`: 分类 slug，可选
- `tag`: 标签 slug，可选
- `q`: 搜索关键词，可选，首版可先不实现

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "slug": "markdown-syntax-showcase",
      "title": "Markdown 语法全量展示",
      "description": "文章摘要",
      "category": {
        "slug": "markdown",
        "name": "Markdown"
      },
      "tags": [
        {
          "slug": "gfm",
          "name": "GFM"
        }
      ],
      "coverImageUrl": null,
      "wordCount": 3600,
      "readingMinutes": 12,
      "publishedAt": "2026-07-02T00:00:00.000Z",
      "updatedAt": "2026-07-02T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### Get Article Detail

`GET /api/articles/:slug`

Response:

```json
{
  "id": "uuid",
  "slug": "markdown-syntax-showcase",
  "title": "Markdown 语法全量展示",
  "description": "文章摘要",
  "markdown": "# Markdown 内容",
  "category": {
    "slug": "markdown",
    "name": "Markdown"
  },
  "tags": [
    {
      "slug": "gfm",
      "name": "GFM"
    }
  ],
  "coverImageUrl": null,
  "wordCount": 3600,
  "readingMinutes": 12,
  "publishedAt": "2026-07-02T00:00:00.000Z",
  "updatedAt": "2026-07-02T00:00:00.000Z"
}
```

### List Article Comments

`GET /api/articles/:slug/comments`

Query:

- `page`: 默认 `1`
- `pageSize`: 默认 `20`，最大 `50`

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "body": "评论内容",
      "parentCommentId": null,
      "createdAt": "2026-07-02T00:00:00.000Z",
      "updatedAt": "2026-07-02T00:00:00.000Z",
      "author": {
        "id": "uuid",
        "login": "octocat",
        "name": "Octocat",
        "avatarUrl": "https://avatars.githubusercontent.com/u/123456?v=4",
        "profileUrl": "https://github.com/octocat"
      },
      "replies": [
        {
          "id": "reply-uuid",
          "body": "回复内容",
          "parentCommentId": "uuid",
          "createdAt": "2026-07-02T00:01:00.000Z",
          "updatedAt": "2026-07-02T00:01:00.000Z",
          "author": {
            "id": "user-uuid",
            "login": "another-user",
            "name": null,
            "avatarUrl": null,
            "profileUrl": "https://github.com/another-user"
          },
          "replies": []
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

### Create Article Comment

`POST /api/articles/:slug/comments`

Request:

```json
{
  "body": "评论内容",
  "parentCommentId": null
}
```

`parentCommentId` 可选；传入可见评论 ID 时创建回复。列表分页只统计顶层评论，回复随所属顶层评论一起返回。

Status semantics:

- `201`: created
- `400`: invalid body
- `401`: GitHub login required
- `404`: article not found, not published, or parent comment not found

### Auth

- `GET /api/auth/github/start?returnTo=/posts/:slug`: website 同源路由，代理服务端启动 GitHub OAuth 并转发 OAuth 临时 cookie。
- `GET /api/auth/github/callback`: website 同源路由，代理服务端处理 GitHub OAuth callback 并把 session cookie 写到 website 域。
- `GET /api/auth/me`: returns the current session user or `null`.
- `POST /api/auth/logout`: clears the current session.

Error shape:

```json
{
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "Article not found"
  }
}
```

Status semantics:

- `200`: success
- `400`: invalid query parameters
- `404`: article not found or not published
- `500`: unexpected server error, no internal details exposed

## Docker 与配置

Docker 目标：

- `apps/server` 构建成独立 Node 镜像。
- PostgreSQL 作为 Compose service。
- 服务端通过 `DATABASE_URL` 连接数据库。
- 真实账号密码不提交到仓库。

建议环境变量：

```text
SERVER_PORT=3001
BACKEND_API_BASE_URL=http://localhost:3001
POSTGRES_HOST=postgres
POSTGRES_PORT=15432
POSTGRES_DB=adrian_zephyr_notes
POSTGRES_USER=Adrian-Zephyr-Liao
POSTGRES_PASSWORD=<只写入本地 .env>
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public
FRONTEND_ORIGIN=http://localhost:3002
GITHUB_OAUTH_CLIENT_ID=<GitHub OAuth App Client ID>
GITHUB_OAUTH_CLIENT_SECRET=<GitHub OAuth App Client Secret>
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3002/api/auth/github/callback
```

Docker Compose 从仓库根目录 `.env` 读取配置。`.env.example` 提供非敏感模板；真实 `.env` 已被 `.gitignore` 忽略。

## 测试策略

- Domain unit tests: 验证 `Article` 状态、slug、发布可见性规则。
- Application tests: 用内存 Repository fake 验证 use case 行为，不访问数据库。
- Infrastructure tests: 用测试 PostgreSQL 验证 Prisma repository 查询和映射。
- E2E tests: 验证 `GET /api/articles` 和 `GET /api/articles/:slug`。

首版必须覆盖：

- 草稿文章不会出现在前台列表。
- 未来发布时间文章不会出现在前台列表。
- 不存在或未发布 slug 返回 `404`。
- 列表分页参数被正确限制。

## 实施顺序

1. 增加 Prisma、配置加载和 PostgreSQL 连接健康检查。
2. 定义 Article domain、repository interface 和 use cases。
3. 增加 Prisma schema、migration、seed 示例文章。
4. 实现 Prisma repository 和 REST controller。
5. 让网站前台从 API 读取文章，移除运行时静态文章依赖。
6. 增加 GitHub OAuth、本地 session 和文章评论接口。
7. 增加 Dockerfile、Compose、`.env.example` 和启动文档。

## 边界

Always:

- 所有运行时文章数据从 PostgreSQL 读取。
- API 入参在 Controller DTO 层校验。
- 不在响应里泄漏数据库字段名、栈信息或 Prisma 错误。
- 用 Repository 接口隔离数据库实现。

Ask first:

- PostgreSQL 用户名、密码、宿主端口。
- 是否启用全文搜索。
- 是否开放管理端写入 API。
- 是否把 Markdown 图片也纳入服务端资源模型。

Never:

- 不提交真实数据库密码。
- 不在前台 API 返回草稿或归档文章。
- 不让 Controller 直接访问 Prisma。
- 不把临时 seed 数据当成生产数据来源。

## 已确认决策

- PostgreSQL 用户名：`Adrian-Zephyr-Liao`
- PostgreSQL 宿主机暴露端口：`15432`
- 数据库名：`adrian_zephyr_notes`
- 文章 slug：沿用当前短 ID 形式，例如 `5f7448b7`
- PostgreSQL 密码：只保存到本地 `.env`，不记录在文档或可提交文件中
