import type {
  ArticleCategoryDetailResponse,
  ArticleCommentsResponse,
  ArticleDetailResponse,
  ArticleListResponse,
  ArticleTagDetailResponse,
  ArticleTagListResponse,
  GuestbookMessagesResponse,
  SiteConfigResponse,
} from "@adrian-zephyr-notes/contracts";

export const category = {
  slug: "engineering",
  name: "工程实践",
  description: "从问题出发，记录解决方案与取舍。",
  publishedArticleCount: 4,
} satisfies ArticleCategoryDetailResponse;
export const tag = {
  slug: "design",
  name: "设计",
  publishedArticleCount: 4,
} satisfies ArticleTagDetailResponse;

// Deliberately repeat headers and section context to catch duplicate table landmarks.
const tableFixture =
  "| 阶段 | 验证方法 | 结果 |\n| --- | --- | --- |\n| 设计与工程 | 在桌面和手机上验证阅读与键盘操作 | `authorization_pending` |";

export const articles: ArticleDetailResponse[] = [
  "写下一个想法，让灵感成为可以分享的作品",
  "在设计与工程之间找到恰好的平衡",
  "阅读、实践和持续改进的笔记",
  "把复杂问题拆解成清楚的小步骤",
].map((title, index) => ({
  id: `article-${index + 1}`,
  slug: `note-${index + 1}`,
  title,
  description: "关注实际问题，解释方案与权衡，也留下值得继续探索的方向。",
  origin: "ORIGINAL",
  source: null,
  category,
  tags: [tag],
  coverImageUrl:
    index === 3 ? "legacy-invalid-cover" : "/images/illustrations/blog-hero-workspace.png",
  wordCount: 1200,
  readingMinutes: 5,
  publishedAt: "2026-11-06T08:00:00.000Z",
  updatedAt: "2026-11-06T08:00:00.000Z",
  aiSummary: null,
  markdown: [
    "## 从问题开始\n\n记录具体问题与设计过程。",
    "## 验证方案\n\n在桌面和手机上验证阅读体验。",
    "## 留下思考\n\n持续改进，保持代码清楚。",
    tableFixture,
    tableFixture,
    "### 复核结果",
    tableFixture,
    tableFixture,
  ].join("\n\n"),
}));

export const firstArticlePage = {
  data: articles.slice(0, 3),
  pagination: { page: 1, pageSize: 12, totalItems: 4, totalPages: 2 },
} satisfies ArticleListResponse;
export const secondArticlePage = {
  data: articles.slice(3),
  pagination: { page: 2, pageSize: 12, totalItems: 4, totalPages: 2 },
} satisfies ArticleListResponse;
export const tags = {
  data: [tag],
  pagination: { page: 1, pageSize: 24, totalItems: 1, totalPages: 1 },
} satisfies ArticleTagListResponse;
export const emptyComments = {
  data: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
} satisfies ArticleCommentsResponse;
export const emptyGuestbook = {
  data: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 },
} satisfies GuestbookMessagesResponse;
export const siteConfig = {
  announcements: [],
  home: {
    eyebrow: "Adrian Zephyr Notes",
    title: "记录想法",
    subtitle: "工程、设计和持续学习。",
    primaryActionLabel: "阅读文章",
    primaryActionHref: "/archives",
    secondaryActionLabel: "留言",
    secondaryActionHref: "/comments",
  },
  navigationItems: [],
  socialLinks: [],
} satisfies SiteConfigResponse;
