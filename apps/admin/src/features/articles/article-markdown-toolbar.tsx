import { Bold, Code, Heading2, Italic, Link, Quote } from "lucide-react";
import { Button } from "../../components/ui/button";
import { ArticleImageUploadButton } from "./article-image-upload-button";
import type { ArticleMarkdownFormat } from "./article-markdown-formatting";

function ArticleMarkdownToolbar({
  isUploading,
  onFormat,
  onImageSelected,
}: {
  isUploading: boolean;
  onFormat: (format: ArticleMarkdownFormat) => void;
  onImageSelected: (file: File) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-y border-border px-2 py-1.5"
      role="group"
      aria-label="Markdown 格式工具"
    >
      <div className="flex items-center gap-0.5">
        {(
          [
            { format: "bold", label: "加粗", hint: "加粗（⌘ / Ctrl + B）", icon: Bold },
            { format: "italic", label: "斜体", hint: "斜体（⌘ / Ctrl + I）", icon: Italic },
            { format: "heading", label: "二级标题", hint: "插入二级标题", icon: Heading2 },
            { format: "link", label: "插入链接", hint: "插入链接", icon: Link },
            { format: "code", label: "行内代码", hint: "插入行内代码", icon: Code },
            { format: "quote", label: "引用", hint: "插入引用", icon: Quote },
          ] as const
        ).map((item) => (
          <Button
            key={item.format}
            type="button"
            variant="ghost"
            size="icon"
            aria-label={item.label}
            title={item.hint}
            onClick={() => onFormat(item.format)}
          >
            <item.icon className="size-4" />
          </Button>
        ))}
      </div>
      <ArticleImageUploadButton isUploading={isUploading} onImageSelected={onImageSelected} />
    </div>
  );
}

export { ArticleMarkdownToolbar };
