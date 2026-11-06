import type { Metadata } from "next";
import { HomeContent } from "@/features/home";
import { getArticles } from "@/lib/articles-api";
import { site } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const articles = await getArticles();
  const latest = articles.data[0];

  return {
    openGraph: {
      title: site.title,
      description: site.description,
      images: latest?.coverImageUrl ? [{ url: latest.coverImageUrl, alt: latest.title }] : [],
    },
  };
}

export default async function Home() {
  const articles = await getArticles();

  return <HomeContent articles={articles.data} />;
}
