import { ImagePlus, Loader2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "../../components/ui/button";
import { ARTICLE_IMAGE_ACCEPT } from "./article-image-file";

function ArticleImageUploadButton({
  isUploading,
  onImageSelected,
}: {
  isUploading: boolean;
  onImageSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={ARTICLE_IMAGE_ACCEPT}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (file) {
            onImageSelected(file);
          }

          event.target.value = "";
        }}
      />
      <Button
        disabled={isUploading}
        size="sm"
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? (
          <Loader2 className="animate-spin motion-reduce:animate-none" />
        ) : (
          <ImagePlus />
        )}
        {isUploading ? "正在上传" : "上传图片"}
      </Button>
    </>
  );
}

export { ArticleImageUploadButton };
