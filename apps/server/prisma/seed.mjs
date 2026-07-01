import "dotenv/config";
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
    throw new Error("Unable to load the frontend markdown showcase post.");
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

await main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
