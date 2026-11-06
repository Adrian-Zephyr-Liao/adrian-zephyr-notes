import type { Metadata } from "next";

import {
  ArticleArchive,
  parseArchiveQuery,
  type ArchiveSearchParams,
} from "@/features/article-archive";
import { getArticleCategories, getArticles } from "@/lib/articles-api";

type ArchivesPageProps = {
  searchParams: Promise<ArchiveSearchParams>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "文章归档 | Adrian Zephyr Notes",
  description: "按时间浏览 Adrian Zephyr Notes 的全部公开文章。",
};

async function ArchivesPage({ searchParams }: ArchivesPageProps) {
  const query = parseArchiveQuery(await searchParams);
  const [articles, categories] = await Promise.all([
    getArticles({
      q: query.q,
      category: query.category,
      tag: query.tag,
      page: query.page,
      pageSize: 12,
    }),
    getArticleCategories(),
  ]);

  return <ArticleArchive articles={articles} categories={categories.data} query={query} />;
}

export default ArchivesPage;
