const ARTICLE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const ARTICLE_IMAGE_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif";
const ARTICLE_IMAGE_MIME_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

function getArticleImageFileError(file: Pick<File, "size" | "type">) {
  if (file.size === 0) {
    return "请选择非空图片文件。";
  }

  if (file.size > ARTICLE_IMAGE_MAX_BYTES) {
    return "图片不能超过 10 MB。";
  }

  if (file.type && !ARTICLE_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
    return "仅支持 JPEG、PNG、WebP 和 GIF 图片。";
  }

  return null;
}

export { ARTICLE_IMAGE_ACCEPT, ARTICLE_IMAGE_MAX_BYTES, getArticleImageFileError };
