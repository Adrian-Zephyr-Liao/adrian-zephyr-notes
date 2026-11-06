import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import type { AdminArticleImageUploadResponse } from "@adrian-zephyr-notes/contracts";
import type { Definition, Image, ImageReference } from "mdast";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import type { ApiClient } from "../core/api.ts";
import { CliError } from "../core/errors.ts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type LocalImage = { path: string; name: string; mimeType: string; bytes: Buffer };
type ImageReplacement = {
  start: number;
  end: number;
  alt: string;
  title: string | null;
  path: string;
};
type PreparedMarkdown = {
  markdown: string;
  images: LocalImage[];
  replacements: ImageReplacement[];
};

function imageMime(bytes: Buffer): string {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  throw new CliError("IMAGE_TYPE_UNSUPPORTED", "Only PNG, JPEG, GIF and WebP images are supported");
}

async function readImage(path: string): Promise<LocalImage> {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_IMAGE_BYTES)
      throw new CliError("INVALID_IMAGE", "Images must be regular nonempty files up to 10 MiB");
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of file.createReadStream({ autoClose: false })) {
      size += chunk.length;
      if (size > MAX_IMAGE_BYTES)
        throw new CliError("IMAGE_TOO_LARGE", "Images are limited to 10 MiB");
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    return { path, name: basename(path), mimeType: imageMime(bytes), bytes };
  } finally {
    await file.close();
  }
}

function markdownImage(alt: string, url: string, title: string | null = null): string {
  const label = alt
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("\n", " ");
  const destination = url
    .replaceAll("<", "%3C")
    .replaceAll(">", "%3E")
    .replaceAll("\n", "%0A")
    .replaceAll("\r", "%0D");
  const suffix =
    title === null
      ? ""
      : ` "${title.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", " ")}"`;
  return `![${label}](<${destination}>${suffix})`;
}

async function uploadImage(
  api: ApiClient,
  image: LocalImage,
): Promise<AdminArticleImageUploadResponse> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(image.bytes)], { type: image.mimeType }),
    image.name,
  );
  const uploaded = await api.json<AdminArticleImageUploadResponse>("/api/admin/articles/images", {
    method: "POST",
    body: form,
  });
  let url: URL;
  try {
    url = new URL(uploaded.url);
  } catch {
    throw new CliError(
      "INVALID_RESPONSE",
      "Upload returned an invalid image URL; do not retry automatically",
    );
  }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new CliError(
      "INVALID_RESPONSE",
      "Upload returned an unsafe image URL; do not retry automatically",
    );
  return uploaded;
}

async function prepareMarkdown(markdown: string, assetsRoot: string): Promise<PreparedMarkdown> {
  const tree = unified().use(remarkParse).parse(markdown);
  const definitions = new Map<string, Definition>();
  visit(tree, "definition", (node) => {
    if (!definitions.has(node.identifier)) definitions.set(node.identifier, node);
  });
  const nodes: Array<{ node: Image | ImageReference; url: string; title: string | null }> = [];
  visit(tree, (node) => {
    if (node.type === "image") nodes.push({ node, url: node.url, title: node.title ?? null });
    if (node.type === "imageReference") {
      const definition = definitions.get(node.identifier);
      if (definition) nodes.push({ node, url: definition.url, title: definition.title ?? null });
    }
  });
  const local = nodes.filter(({ url }) => !/^(?:https?:|data:|\/\/|#)/i.test(url));
  if (local.length > 100)
    throw new CliError(
      "TOO_MANY_IMAGES",
      "Markdown is limited to 100 local image references per command",
    );
  if (!local.length) return { markdown, images: [], replacements: [] };
  const root = await realpath(assetsRoot);
  const images = new Map<string, LocalImage>();
  const replacements: ImageReplacement[] = [];
  let total = 0;
  for (const { node, url, title } of local) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(url);
    } catch {
      throw new CliError("INVALID_IMAGE_PATH", `Malformed image path: ${url}`);
    }
    if (
      isAbsolute(decoded) ||
      /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
      /[?#]/.test(decoded) ||
      decoded.includes("\0")
    )
      throw new CliError(
        "INVALID_IMAGE_PATH",
        "Use relative local image paths without query strings or fragments",
      );
    const path = await realpath(resolve(root, decoded));
    const within = relative(root, path);
    if (within === ".." || within.startsWith(`..${sep}`) || isAbsolute(within))
      throw new CliError("IMAGE_OUTSIDE_ROOT", `Image escapes --assets-root: ${url}`);
    if (!images.has(path)) {
      const image = await readImage(path);
      total += image.bytes.length;
      if (total > 50 * 1024 * 1024)
        throw new CliError(
          "IMAGES_TOO_LARGE",
          "Total local images are limited to 50 MiB per command",
        );
      images.set(path, image);
    }
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (start === undefined || end === undefined)
      throw new CliError("INVALID_MARKDOWN", "Cannot locate image in Markdown source");
    replacements.push({ start, end, alt: node.alt ?? "", title, path });
  }
  return { markdown, images: [...images.values()], replacements };
}

async function uploadMarkdown(api: ApiClient, prepared: PreparedMarkdown) {
  const uploaded: Array<AdminArticleImageUploadResponse & { localPath: string }> = [];
  try {
    for (const image of prepared.images)
      uploaded.push({ ...(await uploadImage(api, image)), localPath: image.path });
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ imageUploads: uploaded, articleWritten: false })}\n`);
    throw error;
  }
  const urls = new Map(uploaded.map((image) => [image.localPath, image.url]));
  let markdown = prepared.markdown;
  for (const replacement of [...prepared.replacements].sort((a, b) => b.start - a.start)) {
    markdown =
      markdown.slice(0, replacement.start) +
      markdownImage(replacement.alt, urls.get(replacement.path)!, replacement.title) +
      markdown.slice(replacement.end);
  }
  return { markdown, images: uploaded };
}

export { readImage, uploadImage, markdownImage, prepareMarkdown, uploadMarkdown };
export type { PreparedMarkdown };
