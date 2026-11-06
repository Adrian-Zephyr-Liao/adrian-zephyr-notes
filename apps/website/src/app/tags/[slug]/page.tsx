import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { normalizeTaxonomyPage, TaxonomyArticles } from "@/features/article-taxonomy";
import { getArticles, getArticleTagBySlug } from "@/lib/articles-api";

type TagPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

const PAGE_SIZE = 12;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = await getArticleTagBySlug(slug);
  return tag
    ? { title: `${tag.name} | Adrian Zephyr Notes`, description: `浏览 ${tag.name} 标签下的文章。` }
    : { title: "标签不存在 | Adrian Zephyr Notes" };
}

async function TagPage({ params, searchParams }: TagPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [tag, articles] = await Promise.all([
    getArticleTagBySlug(slug),
    getArticles({ page: normalizeTaxonomyPage(query.page), pageSize: PAGE_SIZE, tag: slug }),
  ]);

  if (!tag) notFound();

  return (
    <TaxonomyArticles
      kind="tag"
      slug={tag.slug}
      title={tag.name}
      count={tag.publishedArticleCount}
      articles={articles}
    />
  );
}

export default TagPage;
