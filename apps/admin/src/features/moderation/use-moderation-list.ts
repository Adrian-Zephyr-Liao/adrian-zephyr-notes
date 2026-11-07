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
  const resultsRef = useRef<HTMLElement>(null);
  const focusRecovery = useRef<{
    query: Query;
    trigger: HTMLElement;
    id: string;
    action: string;
    ready: boolean;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const setQuery: Dispatch<SetStateAction<Query>> = useCallback((action) => {
    const next = typeof action === "function" ? action(currentQuery.current) : action;
    if (next === currentQuery.current) return;
    // Invalidate immediately, including callbacks settling before the next effect runs.
    latestRequest.current = null;
    focusRecovery.current = null;
    setStatusMessage("");
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
      setStatusMessage("");
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
        if (focusRecovery.current?.query === owner) focusRecovery.current.query = effectiveQuery;
        setStatusMessage(needsRefresh.current ? "操作已成功，审核结果已更新。" : "");
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
    const cancelFocusRecovery = () => {
      focusRecovery.current = null;
    };
    const trackFocus = (event: FocusEvent) => {
      const recovery = focusRecovery.current;
      const target = event.target;
      if (!recovery || !(target instanceof HTMLElement)) return;
      // Dialog autofocus and returning to the trigger belong to this operation.
      // Any other focus movement is the user's choice, even if it later blurs.
      if (
        target === recovery.trigger ||
        target === document.body ||
        target.closest('[role="alertdialog"]')
      )
        return;
      cancelFocusRecovery();
    };
    document.addEventListener("focusin", trackFocus);
    window.addEventListener("blur", cancelFocusRecovery);
    return () => {
      mounted.current = false;
      latestRequest.current = null;
      focusRecovery.current = null;
      document.removeEventListener("focusin", trackFocus);
      window.removeEventListener("blur", cancelFocusRecovery);
    };
  }, []);

  useEffect(() => {
    // Page correction already loaded this query; avoid requesting it twice.
    if (loadedQuery.current !== query) void load(query);
  }, [query, load]);

  useEffect(() => {
    const recovery = focusRecovery.current;
    if (
      !recovery?.ready ||
      updatingId !== null ||
      state.status === "loading" ||
      state.query !== query
    )
      return;
    let observer: MutationObserver | undefined;
    const restoreFocus = () => {
      if (
        focusRecovery.current !== recovery ||
        recovery.query !== currentQuery.current ||
        !mounted.current
      ) {
        observer?.disconnect();
        return;
      }
      const active = document.activeElement;
      // A fast response can finish before the dialog's exit animation. Wait for
      // its removal instead of moving focus into a still-active focus trap.
      if (active instanceof HTMLElement && active.closest('[role="alertdialog"]')) return;
      focusRecovery.current = null;
      observer?.disconnect();
      if (active && active !== document.body && active !== document.documentElement) return;
      const region = resultsRef.current;
      const row = Array.from(
        region?.querySelectorAll<HTMLElement>("[data-moderation-id]") ?? [],
      ).find((element) => element.dataset.moderationId === recovery.id);
      const actions = Array.from(
        row?.querySelectorAll<HTMLButtonElement>("button[data-moderation-action]:not(:disabled)") ??
          [],
      );
      const action =
        actions.find((element) => element.dataset.moderationAction === recovery.action) ??
        actions[0];
      (action ?? region)?.focus();
    };
    restoreFocus();
    if (focusRecovery.current === recovery) {
      observer = new MutationObserver(restoreFocus);
      observer.observe(document.body, { childList: true, subtree: true });
    }
    return () => observer?.disconnect();
  }, [query, state, updatingId]);

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
    const trigger = document.activeElement;
    focusRecovery.current =
      trigger instanceof HTMLElement &&
      trigger.dataset.moderationAction &&
      resultsRef.current?.contains(trigger)
        ? { query: owner, trigger, id, action: trigger.dataset.moderationAction, ready: false }
        : null;
    let writeStarted = false;
    mutationPending.current = true;
    setUpdatingId(id);
    setState((current) => ({ ...current, error: null }));
    try {
      if (confirm && !(await confirm())) {
        focusRecovery.current = null;
        return;
      }
      if (!mounted.current || currentQuery.current !== owner) return;
      try {
        writeStarted = true;
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
      if (writeStarted && focusRecovery.current) focusRecovery.current.ready = true;
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
    resultsRef,
    statusMessage,
    mutate,
  };
}

export { useModerationList };
