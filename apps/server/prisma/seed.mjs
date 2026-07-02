import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script, createContext } from "node:vm";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import ts from "typescript";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed articles.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const ARTICLE_SUMMARY_PROMPT_VERSION = "article-summary-v1";

async function main() {
  const post = await loadMarkdownSyntaxShowcasePost();
  const now = new Date();
  const createdAt = toUtcDate(post.createdAt);
  const updatedAt = toUtcDate(post.updatedAt);
  const categorySlug = categorySlugByName(post.category);

  const category = await prisma.articleCategory.upsert({
    where: { slug: categorySlug },
    update: {
      name: post.category,
      updatedAt: now,
    },
    create: {
      slug: categorySlug,
      name: post.category,
      description: `${post.category}分类文章`,
      createdAt,
      updatedAt,
    },
  });

  const tags = await Promise.all(
    post.tags.map((tagName) =>
      prisma.articleTag.upsert({
        where: { slug: tagSlugByName(tagName) },
        update: {
          name: tagName,
          updatedAt: now,
        },
        create: {
          slug: tagSlugByName(tagName),
          name: tagName,
          createdAt,
          updatedAt,
        },
      }),
    ),
  );

  const article = await prisma.article.upsert({
    where: { slug: post.slug },
    update: {
      title: post.title,
      description: post.description,
      markdown: post.markdown,
      status: "PUBLISHED",
      categoryId: category.id,
      coverImageUrl: null,
      wordCount: post.wordCount,
      readingMinutes: post.readingMinutes,
      publishedAt: createdAt,
      updatedAt,
    },
    create: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      markdown: post.markdown,
      status: "PUBLISHED",
      categoryId: category.id,
      coverImageUrl: null,
      wordCount: post.wordCount,
      readingMinutes: post.readingMinutes,
      publishedAt: createdAt,
      createdAt,
      updatedAt,
    },
  });

  await prisma.articleTagLink.deleteMany({
    where: {
      articleId: article.id,
    },
  });

  await prisma.articleTagLink.createMany({
    data: tags.map((tag) => ({
      articleId: article.id,
      tagId: tag.id,
    })),
    skipDuplicates: true,
  });

  await queueArticleAiSummary(article.id, post);
  await seedSiteAnnouncements(now);
}

async function queueArticleAiSummary(articleId, post) {
  const contentHash = createArticleSummaryContentHash({
    title: post.title,
    description: post.description,
    markdown: post.markdown,
  });
  const current = await prisma.articleAiSummary.findUnique({
    where: { articleId },
  });

  if (
    current &&
    current.contentHash === contentHash &&
    current.promptVersion === ARTICLE_SUMMARY_PROMPT_VERSION
  ) {
    return;
  }

  await prisma.articleAiSummary.upsert({
    where: { articleId },
    update: {
      attemptCount: 0,
      contentHash,
      errorMessage: null,
      generatedAt: null,
      model: null,
      promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
      provider: null,
      status: "PENDING",
      summary: null,
    },
    create: {
      articleId,
      contentHash,
      promptVersion: ARTICLE_SUMMARY_PROMPT_VERSION,
      status: "PENDING",
    },
  });
}

async function seedSiteAnnouncements(now) {
  const announcements = [
    {
      key: "writing-queue",
      title: "writing queue",
      icon: "sparkles-2-line",
      iconClassName: "text-[oklch(0.64_0.18_36)]",
      process: "notes.sync",
      status: "running",
      command: "pnpm notes:sync --scope writing",
      output: "长期有效的思考正在整理成更耐读的笔记。",
      sortOrder: 10,
    },
    {
      key: "context-watcher",
      title: "context watcher",
      icon: "book-6-ai-line",
      iconClassName: "text-primary",
      process: "post.watch",
      status: "updated",
      command: "vp post:watch --include context",
      output: "旧文章可能随资料、结论和实践方式一起重新校准。",
      sortOrder: 20,
    },
    {
      key: "feedback-pipe",
      title: "feedback pipe",
      icon: "question-line",
      iconClassName: "text-[oklch(0.58_0.21_28)]",
      process: "comment.pipe",
      status: "listening",
      command: "open mailbox --mode discussion",
      output: "欢迎留下场景、约束和取舍清楚的不同经验。",
      sortOrder: 30,
    },
  ];

  for (const announcement of announcements) {
    await prisma.siteAnnouncement.upsert({
      where: { key: announcement.key },
      update: {
        ...announcement,
        isEnabled: true,
        updatedAt: now,
      },
      create: {
        ...announcement,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}

async function loadMarkdownSyntaxShowcasePost() {
  const source = await readFile(
    resolve(repoRoot, "apps/website/src/content/posts/markdown-syntax-showcase.ts"),
    "utf8",
  );
  const transpiled = ts.transpileModule(
    `${source}\nglobalThis.__markdownSyntaxShowcasePost = markdownSyntaxShowcasePost;`,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const context = createContext({
    exports: {},
    globalThis: {},
    module: { exports: {} },
  });

  new Script(transpiled.outputText).runInContext(context);

  const post = context.globalThis.__markdownSyntaxShowcasePost;

  if (!isMarkdownPost(post)) {
    throw new Error("Unable to load the frontend markdown reference post.");
  }

  return post;
}

function isMarkdownPost(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.description === "string" &&
    typeof value.category === "string" &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    typeof value.wordCount === "number" &&
    typeof value.readingMinutes === "number" &&
    typeof value.markdown === "string"
  );
}

function toUtcDate(value) {
  return new Date(`${value}T00:00:00.000Z`);
}

function categorySlugByName(value) {
  if (value === "笔记") {
    return "notes";
  }

  return tagSlugByName(value);
}

function tagSlugByName(value) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, "-");
}

function createArticleSummaryContentHash(input) {
  return createHash("sha256")
    .update(JSON.stringify([input.title, input.description, input.markdown]))
    .digest("hex");
}

await main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
