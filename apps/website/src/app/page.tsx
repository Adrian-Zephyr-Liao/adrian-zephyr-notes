import type { Metadata } from "next";
import { HomeContent } from "@/features/home";
import { getArticleCoverSource } from "@/entities/article";
import { getArticles } from "@/lib/articles-api";
import { site } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const articles = await getArticles();
  const latest = articles.data[0];
  const cover = latest ? getArticleCoverSource(latest.coverImageUrl) : null;

  return {
    openGraph: {
      title: site.title,
      description: site.description,
      images: cover && latest ? [{ url: cover, alt: latest.title }] : [],
    },
  };
}

export default async function Home() {
  const articles = await getArticles();

  return <HomeContent articles={articles.data} />;
}
