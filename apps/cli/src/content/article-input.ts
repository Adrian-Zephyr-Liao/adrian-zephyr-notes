import type {
  CreateAdminArticleRequest,
  UpdateAdminArticleRequest,
} from "@adrian-zephyr-notes/contracts";
import { CliError, isRecord } from "../core/errors.ts";
import { readText } from "../core/input.ts";
function stringValue(values: Record<string, string | boolean | undefined>, key: string) {
  return typeof values[key] === "string" ? values[key] : undefined;
}
async function articleInput(values: Record<string, string | boolean | undefined>, create: boolean) {
  const inputPath = stringValue(values, "input");
  const markdownPath = stringValue(values, "file");
  if (inputPath === "-" && markdownPath === "-")
    throw new CliError("INVALID_ARGUMENT", "Only one option can read stdin");
  let fields: Record<string, unknown> = {};
  if (inputPath !== undefined) {
    try {
      const data: unknown = JSON.parse(await readText(inputPath));
      if (!isRecord(data)) throw new Error("Expected an object");
      fields = data;
    } catch (error) {
      if (error instanceof CliError) throw error;
      throw new CliError("INVALID_INPUT", "--input must contain a JSON object of article fields");
    }
  }
  const fieldMap: Record<string, string> = {
    title: "title",
    description: "description",
    category: "categorySlug",
    "cover-image": "coverImageUrl",
    origin: "origin",
    "source-name": "sourceName",
    "source-author": "sourceAuthor",
    "source-url": "sourceUrl",
    status: "status",
  };
  for (const [option, field] of Object.entries(fieldMap)) {
    const value = stringValue(values, option);
    if (value !== undefined) fields[field] = value;
  }
  const tags = stringValue(values, "tags");
  if (tags !== undefined)
    fields.tagSlugs = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  if (markdownPath !== undefined) fields.markdown = await readText(markdownPath);
  const knownFields = new Set([...Object.values(fieldMap), "markdown", "tagSlugs"]);
  const nullableFields = [
    "categorySlug",
    "coverImageUrl",
    "sourceName",
    "sourceAuthor",
    "sourceUrl",
  ];
  for (const [field, value] of Object.entries(fields)) {
    if (!knownFields.has(field))
      throw new CliError("INVALID_INPUT", `Unknown article field: ${field}`);
    if (field === "tagSlugs") {
      if (
        !Array.isArray(value) ||
        value.length > 5 ||
        value.some((item) => typeof item !== "string")
      )
        throw new CliError("INVALID_INPUT", "tagSlugs must contain at most five strings");
    } else if (typeof value !== "string" && !(value === null && nullableFields.includes(field))) {
      throw new CliError(
        "INVALID_INPUT",
        `${field} must be a string${nullableFields.includes(field) ? " or null" : ""}`,
      );
    }
  }
  if (fields.status !== undefined && fields.status !== "DRAFT" && fields.status !== "ARCHIVED") {
    throw new CliError("INVALID_INPUT", "Use 'articles publish <id>' to publish explicitly");
  }
  if (fields.origin !== undefined && fields.origin !== "ORIGINAL" && fields.origin !== "REPOSTED")
    throw new CliError("INVALID_INPUT", "origin must be ORIGINAL or REPOSTED");
  if (create) {
    if (fields.status !== undefined && fields.status !== "DRAFT")
      throw new CliError("INVALID_INPUT", "New articles must start as DRAFT");
    fields.status = "DRAFT";
    fields.description ??= "";
    if (
      typeof fields.title !== "string" ||
      !fields.title.trim() ||
      typeof fields.markdown !== "string" ||
      !fields.markdown.trim()
    )
      throw new CliError(
        "INVALID_INPUT",
        "Create requires a nonempty title and Markdown (--file or --input)",
      );
  } else if (Object.keys(fields).length === 0) {
    throw new CliError("INVALID_INPUT", "Provide at least one article field to update");
  }
  return fields as CreateAdminArticleRequest | UpdateAdminArticleRequest;
}

export { articleInput };
