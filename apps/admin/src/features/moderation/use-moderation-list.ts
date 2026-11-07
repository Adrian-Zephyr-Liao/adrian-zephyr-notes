import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { AdminApiError } from "../../lib/admin-http";

type ListQuery = { page?: number; pageSize?: number };
type ListResult<Item> = {
  data: Item[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};
type ListState<Query, Item> = {
  query: Query;
  error: string | null;
} & ({ status: "ready"; result: ListResult<Item> } | { status: "loading" | "error"; result: null });

function useModerationList<Query extends ListQuery, Item>({
  initialQuery,
  list,
  loadError,
  updateError,
}: {
  initialQuery: Query;
  list: (query: Query) => Promise<ListResult<Item>>;
  loadError: string;
  updateError: string;
}) {
  const [query, setQueryState] = useState(initialQuery);
  const currentQuery = useRef(query);
  const [state, setState] = useState<ListState<Query, Item>>({
    query,
    result: null,
    status: "loading",
    error: null,
  });
  const mounted = useRef(false);
  const latestRequest = useRef<symbol | null>(null);
  const loadedQuery = useRef<Query | null>(null);
  const mutationPending = useRef(false);
  const needsRefresh = useRef(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const setQuery: Dispatch<SetStateAction<Query>> = useCallback((action) => {
    const next = typeof action === "function" ? action(currentQuery.current) : action;
    if (next === currentQuery.current) return;
    // Invalidate immediately, including callbacks settling before the next effect runs.
    latestRequest.current = null;
    currentQuery.current = next;
    setQueryState(next);
  }, []);

  const load = useCallback(
    async (owner: Query) => {
      const requestId = Symbol("moderation-list-request");
      latestRequest.current = requestId;
      const isCurrent = () =>
        mounted.current && currentQuery.current === owner && latestRequest.current === requestId;
      if (!isCurrent()) return;
      setState({ query: owner, result: null, status: "loading", error: null });
      try {
        let effectiveQuery = owner;
        let response = await list(effectiveQuery);
        if (!isCurrent()) return;
        // A moderation change can remove the last item of the last page. Keep the
        // same request ownership and operation lock while reading a valid page.
        while ((effectiveQuery.page ?? 1) > Math.max(response.pagination.totalPages, 1)) {
          effectiveQuery = { ...effectiveQuery, page: Math.max(response.pagination.totalPages, 1) };
          response = await list(effectiveQuery);
          if (!isCurrent()) return;
        }
        loadedQuery.current = effectiveQuery;
        needsRefresh.current = false;
        currentQuery.current = effectiveQuery;
        setQueryState(effectiveQuery);
        setState({ query: effectiveQuery, result: response, status: "ready", error: null });
      } catch {
        if (!isCurrent()) return;
        setState({
          query: owner,
          result: null,
          status: "error",
          error: needsRefresh.current
            ? "操作已成功，列表刷新失败，请刷新查看最新结果。"
            : loadError,
        });
      }
    },
    [list, loadError],
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      latestRequest.current = null;
    };
  }, []);

  useEffect(() => {
    // Page correction already loaded this query; avoid requesting it twice.
    if (loadedQuery.current !== query) void load(query);
  }, [query, load]);

  async function mutate(
    id: string,
    write: () => Promise<unknown>,
    confirm?: () => Promise<boolean>,
  ) {
    if (
      !mounted.current ||
      mutationPending.current ||
      state.query !== currentQuery.current ||
      state.status !== "ready"
    )
      return;
    const owner = currentQuery.current;
    mutationPending.current = true;
    setUpdatingId(id);
    setState((current) => ({ ...current, error: null }));
    try {
      if (confirm && !(await confirm())) return;
      if (!mounted.current || currentQuery.current !== owner) return;
      try {
        await write();
      } catch (error) {
        if (mounted.current && currentQuery.current === owner) {
          const rejected =
            error instanceof AdminApiError && error.status >= 400 && error.status < 500;
          setState((current) =>
            rejected
              ? { ...current, error: updateError }
              : {
                  query: owner,
                  result: null,
                  status: "error",
                  error: "操作结果尚未确认，请刷新核对后再试。",
                },
          );
        }
        return;
      }
      if (!mounted.current) return;
      needsRefresh.current = true;
      // Read the query that is active now, never the mutation's captured query.
      await load(currentQuery.current);
    } finally {
      mutationPending.current = false;
      if (mounted.current) setUpdatingId(null);
    }
  }

  const isCurrent = state.query === query;
  const result = isCurrent && state.status === "ready" ? state.result : null;
  const isReady = result !== null;
  return {
    query,
    setQuery,
    items: result?.data ?? [],
    pagination: result?.pagination ?? null,
    isLoading: !isCurrent || state.status === "loading",
    isReady,
    errorMessage: isCurrent ? state.error : null,
    updatingId,
    mutate,
  };
}

export { useModerationList };
