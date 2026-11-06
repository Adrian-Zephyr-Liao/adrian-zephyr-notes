import type { ArticleListQuery } from "@adrian-zephyr-notes/contracts";

type ArchiveView = "cover" | "timeline";
type ArchiveSearchParams = Record<string, string | string[] | undefined>;
type ArchiveQuery = Pick<ArticleListQuery, "q" | "category" | "tag"> & {
  page: number;
  view: ArchiveView;
};
type ArchiveQueryPatch = {
  [Key in keyof ArchiveQuery]?: ArchiveQuery[Key] | null;
};

const MAX_ARCHIVE_PAGE = 10_000;

function parseArchiveQuery(params: ArchiveSearchParams): ArchiveQuery {
  const pageValue = firstValue(params.page);
  const page = pageValue && /^\d+$/.test(pageValue) ? Number(pageValue) : 1;

  return {
    q: firstValue(params.q),
    category: firstValue(params.category),
    tag: firstValue(params.tag),
    page: Number.isSafeInteger(page) && page > 0 && page <= MAX_ARCHIVE_PAGE ? page : 1,
    view: firstValue(params.view) === "timeline" ? "timeline" : "cover",
  };
}

function archiveHref(query: ArchiveQuery, patch: ArchiveQueryPatch = {}): string {
  const next = { ...query, ...patch };
  const normalized = parseArchiveQuery({
    q: next.q ?? undefined,
    category: next.category ?? undefined,
    tag: next.tag ?? undefined,
    page: next.page?.toString(),
    view: next.view ?? undefined,
  });

  const filtersChanged =
    normalized.q !== query.q ||
    normalized.category !== query.category ||
    normalized.tag !== query.tag;
  if (filtersChanged && !("page" in patch)) normalized.page = 1;

  const params = new URLSearchParams();
  if (normalized.q) params.set("q", normalized.q);
  if (normalized.category) params.set("category", normalized.category);
  if (normalized.tag) params.set("tag", normalized.tag);
  if (normalized.page > 1) params.set("page", String(normalized.page));
  if (normalized.view === "timeline") params.set("view", normalized.view);

  const search = params.toString();
  return search ? `/archives?${search}` : "/archives";
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export { archiveHref, parseArchiveQuery };
export type { ArchiveQuery, ArchiveQueryPatch, ArchiveSearchParams, ArchiveView };
