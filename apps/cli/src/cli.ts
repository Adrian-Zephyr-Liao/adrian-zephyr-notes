import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import type {
  CreateAdminArticleRequest,
  OAuthMeResponse,
  UpdateAdminArticleRequest,
} from "@adrian-zephyr-notes/contracts";
import { CliError, isRecord, login, logout, request, resolveAuth } from "./auth.ts";

const HELP = `AZ Notes CLI — write articles with your Agent

Usage: azn <command> [options]

  auth login --server <API origin> [--no-browser] [--read-only]
  auth status
  auth logout
  articles list [--query <text>] [--status DRAFT|PUBLISHED|ARCHIVED|ALL]
                [--page <number>] [--page-size <number>]
  articles get <id>
  articles taxonomies
  articles create --title <title> --file <article.md|-> [--description <text>]
  articles update <id> [--file <article.md|->] [--title <title>]
  articles publish <id>

Article create/update options:
  --input <json-file|->      Read article fields from JSON (known API fields only)
  --category <slug>         Empty string clears the category
  --tags <slug,slug>        Empty string clears tags; at most five tags
  --cover-image <url>       Empty string clears the cover
  --origin ORIGINAL|REPOSTED
  --source-name <name> --source-author <author> --source-url <url>
  --status DRAFT|ARCHIVED   Update only; use 'articles publish' to publish

All commands accept --server <API origin>. Defaults to AZN_SERVER_URL or saved login.
Success: JSON on stdout. Errors: JSON on stderr with exit code 1.
Login instructions go to stderr; --no-browser works over SSH without inbound ports.
Create always saves a DRAFT. Updates preserve the existing status unless specified;
editing an already published article changes its live content.
Writes are never retried automatically. Review existing articles after a timeout.
Use Node.js 22.18+; no build or model API key is needed by this CLI.
`;

const STRING_OPTIONS = [
  "server",
  "query",
  "status",
  "page",
  "page-size",
  "input",
  "file",
  "title",
  "description",
  "category",
  "tags",
  "cover-image",
  "origin",
  "source-name",
  "source-author",
  "source-url",
] as const;
const ARTICLE_OPTIONS = [
  "input",
  "file",
  "title",
  "description",
  "category",
  "tags",
  "cover-image",
  "origin",
  "source-name",
  "source-author",
  "source-url",
];
const COMMAND_OPTIONS: Record<string, string[]> = {
  "auth login": ["no-browser", "read-only"],
  "auth status": [],
  "auth logout": [],
  "articles list": ["query", "status", "page", "page-size"],
  "articles get": [],
  "articles taxonomies": [],
  "articles create": ARTICLE_OPTIONS,
  "articles update": [...ARTICLE_OPTIONS, "status"],
  "articles publish": [],
};

async function runCli(args: string[]): Promise<unknown> {
  const options: Record<string, { type: "string" | "boolean" }> = Object.fromEntries(
    STRING_OPTIONS.map((name) => [name, { type: "string" as const }]),
  );
  options.help = { type: "boolean" };
  options["no-browser"] = { type: "boolean" };
  options["read-only"] = { type: "boolean" };
  const { values, positionals, tokens } = parseArgs({
    args,
    options,
    allowPositionals: true,
    tokens: true,
  });
  for (const token of tokens) {
    if (
      token.kind === "option" &&
      tokens.filter((other) => other.kind === "option" && other.name === token.name).length > 1
    ) {
      throw new CliError("INVALID_ARGUMENT", `Option --${token.name} must be supplied once`);
    }
  }
  if (values.help || positionals.length === 0) return HELP;
  const [group, action, id] = positionals;
  const command = `${group} ${action}`;
  const allowed = COMMAND_OPTIONS[command];
  if (!allowed) throw new CliError("INVALID_COMMAND", "Unknown command; run azn --help");
  const needsId = ["articles get", "articles update", "articles publish"].includes(command);
  if (positionals.length !== (needsId ? 3 : 2) || (needsId && !id?.trim())) {
    throw new CliError(
      "INVALID_ARGUMENT",
      needsId ? "Provide exactly one article ID" : "Unexpected arguments",
    );
  }
  for (const name of Object.keys(values)) {
    if (name !== "server" && !allowed.includes(name)) {
      throw new CliError("INVALID_ARGUMENT", `--${name} is not supported by ${command}`);
    }
  }
  const server = stringValue(values, "server");
  if (command === "auth login")
    return login(server, values["no-browser"] === true, values["read-only"] === true);
  if (command === "auth logout") return logout(server);

  let payload: CreateAdminArticleRequest | UpdateAdminArticleRequest | undefined;
  if (command === "articles create" || command === "articles update") {
    payload = await articleInput(values, command === "articles create");
  }
  const auth = await resolveAuth(server);
  const headers = { authorization: `Bearer ${auth.token}`, "content-type": "application/json" };
  if (command === "auth status") {
    const status = await request<OAuthMeResponse>(auth.server, "/api/oauth/me", { headers });
    return { authenticated: true, server: auth.server, ...status };
  }
  const path = "/api/admin/articles";
  if (command === "articles list") {
    const query = new URLSearchParams();
    for (const [option, field] of [
      ["query", "q"],
      ["status", "status"],
      ["page", "page"],
      ["page-size", "pageSize"],
    ]) {
      const value = stringValue(values, option);
      if (value === undefined) continue;
      if (option === "status" && !["DRAFT", "PUBLISHED", "ARCHIVED", "ALL"].includes(value)) {
        throw new CliError("INVALID_ARGUMENT", "Invalid article status");
      }
      if (
        (option === "page" || option === "page-size") &&
        (!/^[1-9]\d*$/.test(value) ||
          !Number.isSafeInteger(Number(value)) ||
          (option === "page-size" && Number(value) > 100))
      ) {
        throw new CliError(
          "INVALID_ARGUMENT",
          "Page must be a positive integer; page size is limited to 100",
        );
      }
      query.set(field, value);
    }
    return request(auth.server, `${path}?${query}`, { headers });
  }
  if (command === "articles get")
    return request(auth.server, `${path}/${encodeURIComponent(id!)}`, { headers });
  if (command === "articles taxonomies")
    return request(auth.server, `${path}/taxonomies`, { headers });
  if (command === "articles create")
    return request(auth.server, path, { headers, method: "POST", body: JSON.stringify(payload) });
  return request(auth.server, `${path}/${encodeURIComponent(id!)}`, {
    headers,
    method: "PATCH",
    body: JSON.stringify(command === "articles publish" ? { status: "PUBLISHED" } : payload),
  });
}

function stringValue(values: Record<string, string | boolean | undefined>, key: string) {
  return typeof values[key] === "string" ? values[key] : undefined;
}

async function readInput(path: string) {
  if (path !== "-") return readFile(path, "utf8");
  if (process.stdin.isTTY)
    throw new CliError("INVALID_ARGUMENT", "Pipe input to stdin when using '-'");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 1024 * 1024) throw new CliError("INPUT_TOO_LARGE", "Input is limited to 1 MiB");
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function articleInput(values: Record<string, string | boolean | undefined>, create: boolean) {
  const inputPath = stringValue(values, "input");
  const markdownPath = stringValue(values, "file");
  if (inputPath === "-" && markdownPath === "-")
    throw new CliError("INVALID_ARGUMENT", "Only one option can read stdin");
  let fields: Record<string, unknown> = {};
  if (inputPath !== undefined) {
    try {
      const data: unknown = JSON.parse(await readInput(inputPath));
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
  if (markdownPath !== undefined) fields.markdown = await readInput(markdownPath);
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

export { runCli };
