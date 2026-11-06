"use client";

import { X } from "lucide-react";
import type { ImgHTMLAttributes } from "react";
import Zoom from "react-medium-image-zoom";

function MarkdownImage({ alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <Zoom
      a11yNameButtonZoom="放大图片"
      a11yNameButtonUnzoom="关闭大图"
      classDialog="markdown-image-dialog"
      IconUnzoom={X}
      wrapElement="span"
      zoomMargin={16}
    >
      <img {...props} alt={alt} />
    </Zoom>
  );
}

export { MarkdownImage };
