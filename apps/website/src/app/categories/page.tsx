import type { Metadata } from "next";

import { CategoryDirectory } from "@/features/article-taxonomy";
import { getArticleCategories, getArticles } from "@/lib/articles-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "分类目录 | Adrian Zephyr Notes",
  description: "按分类浏览 Adrian Zephyr Notes 的公开文章。",
};

async function CategoriesPage() {
  const categories = await getArticleCategories();
  const entries = await Promise.all(
    categories.data.map(async (category) => ({
      category,
      article: (await getArticles({ category: category.slug, pageSize: 1 })).data[0] ?? null,
    })),
  );

  return <CategoryDirectory categories={entries} />;
}

export default CategoriesPage;
