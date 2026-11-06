import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArticleReading } from "@/features/article-reading";
import { getArticleCoverSource } from "@/entities/article";
import { getArticleBySlug } from "@/lib/articles-api";
import { getSiteConfig } from "@/lib/site-config-api";

type PostPageProps = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getArticleBySlug(slug);
  if (!post) return {};
  const cover = getArticleCoverSource(post.coverImageUrl);
  return {
    title: `${post.title} | Adrian Zephyr Notes`,
    description: post.description,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      images: cover ? [{ url: cover, alt: post.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: cover ? [cover] : [],
    },
  };
}

async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const [post, siteConfig] = await Promise.all([getArticleBySlug(slug), getSiteConfig()]);
  if (!post) notFound();
  return <ArticleReading post={post} announcements={siteConfig.announcements} />;
}
export default PostPage;
