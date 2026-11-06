import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { normalizeTaxonomyPage, TaxonomyArticles } from "@/features/article-taxonomy";
import { getArticleCategoryBySlug, getArticles } from "@/lib/articles-api";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

const PAGE_SIZE = 12;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = await getArticleCategoryBySlug(slug);

  return category
    ? {
        title: `${category.name} | Adrian Zephyr Notes`,
        description: category.description ?? `浏览 ${category.name} 分类下的全部文章。`,
      }
    : { title: "分类不存在 | Adrian Zephyr Notes" };
}

async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [category, articles] = await Promise.all([
    getArticleCategoryBySlug(slug),
    getArticles({ category: slug, page: normalizeTaxonomyPage(query.page), pageSize: PAGE_SIZE }),
  ]);

  if (!category) notFound();

  return (
    <TaxonomyArticles
      kind="category"
      slug={category.slug}
      title={category.name}
      description={category.description}
      count={category.publishedArticleCount}
      articles={articles}
    />
  );
}

export default CategoryPage;
