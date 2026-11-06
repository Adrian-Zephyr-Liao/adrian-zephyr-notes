import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";

import { ArticleListSection } from "./article-list-section";
import { HomeHero } from "./home-hero";

function HomeContent({ articles }: { articles: ArticleListItemResponse[] }) {
  return (
    <main className="mx-auto w-full max-w-(--site-width) flex-1 px-5 pb-10 sm:px-8">
      <HomeHero articles={articles} />
      <ArticleListSection articles={articles} />
    </main>
  );
}

export { HomeContent };
