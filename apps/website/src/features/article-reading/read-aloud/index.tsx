"use client";

import { Headphones, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReadAloud } from "./use-read-aloud";

function ArticleReadAloud({ contentId, title }: { contentId: string; title: string }) {
  const reader = useReadAloud(contentId, title);
  const active = reader.playback === "playing" || reader.playback === "paused";
  const label =
    reader.playback === "playing"
      ? "暂停朗读"
      : reader.playback === "paused"
        ? "继续朗读"
        : reader.playback === "finished"
          ? "重新朗读"
          : "朗读全文";
  const Icon = reader.playback === "playing" ? Pause : active ? Play : Headphones;

  return (
    <section aria-label="文章朗读" className="mb-8 border-y border-border py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 px-4"
          disabled={!reader.supported}
          onClick={reader.toggle}
        >
          <Icon aria-hidden="true" />
          {label}
        </Button>
        {active ? (
          <Button type="button" variant="ghost" className="min-h-11 px-3" onClick={reader.stop}>
            <Square aria-hidden="true" />
            停止朗读
          </Button>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          语速
          <select
            aria-label="朗读语速"
            className="min-h-11 rounded-lg border border-border bg-background px-2 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50"
            value={reader.rate}
            disabled={!reader.supported}
            onChange={(event) => reader.changeRate(Number(event.target.value))}
          >
            {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <option key={rate} value={rate}>
                {rate}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <output className="mt-3 block text-xs/relaxed text-muted-foreground">
        {reader.supported === false
          ? "当前浏览器不支持语音朗读，可尝试使用其他浏览器。"
          : reader.playback === "finished"
            ? "全文朗读完毕。"
            : active
              ? `${reader.playback === "paused" ? "已暂停" : "正在朗读"} · 第 ${reader.position.current} / ${reader.position.total} 段，语速调整从下一段生效。`
              : "点击后连续朗读全文，跳过代码块与图表。声音由设备提供。"}
      </output>
      {reader.error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {reader.error}
        </p>
      ) : null}
    </section>
  );
}

export { ArticleReadAloud };
