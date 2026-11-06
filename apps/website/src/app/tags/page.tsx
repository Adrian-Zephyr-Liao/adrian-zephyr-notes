import type { Metadata } from "next";

import { normalizeTaxonomyPage, TagDirectory } from "@/features/article-taxonomy";
import { getArticleTags } from "@/lib/articles-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "标签浏览 | Adrian Zephyr Notes",
  description: "按标签浏览 Adrian Zephyr Notes 的文章主题。",
};

type TagsPageProps = { searchParams: Promise<{ page?: string | string[] }> };

async function TagsPage({ searchParams }: TagsPageProps) {
  const query = await searchParams;
  const tags = await getArticleTags({ page: normalizeTaxonomyPage(query.page), pageSize: 24 });

  return <TagDirectory tags={tags} />;
}

export default TagsPage;
