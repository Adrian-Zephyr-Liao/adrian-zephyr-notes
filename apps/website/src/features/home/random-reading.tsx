"use client";

import { Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { homeActionClassName } from "./styles";

function RandomReading({ slugs }: { slugs: string[] }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={cn(
        homeActionClassName,
        "cursor-pointer rounded-2xl border border-primary px-4 py-[0.55rem] hover:bg-accent hover:text-accent-foreground motion-safe:active:translate-y-px max-[680px]:text-[0.72rem]",
      )}
      disabled={slugs.length === 0}
      onClick={() => {
        const slug = slugs[Math.floor(Math.random() * slugs.length)];
        if (slug) router.push(`/posts/${slug}`);
      }}
    >
      <Shuffle size={15} aria-hidden="true" />
      随便翻一篇
    </button>
  );
}

export { RandomReading };
