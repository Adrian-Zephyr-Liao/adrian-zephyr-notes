import { HomeHero } from "@/components/site/home-hero";
import { ArticleListSection } from "@/components/site/article-list-section";
import { getArticles } from "@/lib/articles-api";

export default async function Home() {
  const articles = await getArticles();

  return (
    <main className="flex-1 overflow-hidden px-3 pb-14 sm:px-4">
      <HomeHero articles={articles.data} />
      <ArticleListSection articles={articles.data} />
    </main>
  );
}
