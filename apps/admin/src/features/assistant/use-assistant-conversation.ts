import type {
  AssistantHistoryResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createAssistantConversation,
  getAssistantHistory,
  getAssistantTurn,
  stopAssistantTurn,
} from "./assistant-api";
import { streamAssistantTurn } from "./assistant-stream";

type PendingRequest = {
  requestId: string;
  input: string;
  text: string;
  lastMessageId: string | null;
  toolName: string | null;
  started: boolean;
};

function useAssistantConversation(
  initialConversationId: string | undefined,
  onConversationChange: (id: string | undefined) => void,
) {
  const [history, setHistory] = useState<AssistantHistoryResponse | null>(null);
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [loading, setLoading] = useState(Boolean(initialConversationId));
  const [sending, setSending] = useState(false);
  const [stoppingRequestId, setStoppingRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ requestId: string; input: string } | null>(null);
  const conversationRef = useRef<string | undefined>(undefined);
  const createdConversationRef = useRef<string | null>(null);
  const requestRef = useRef<string | null>(null);
  const streamRef = useRef<ReturnType<typeof streamAssistantTurn> | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);
  // Returning to the same ID must not revive responses from the previous visit.
  const conversationVersion = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      conversationVersion.current += 1;
      streamRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (createdConversationRef.current === initialConversationId) {
      createdConversationRef.current = null;
      return;
    }
    createdConversationRef.current = null;
    conversationVersion.current += 1;
    streamRef.current?.abort();
    requestRef.current = null;
    inFlight.current = false;
    setSending(false);
    setStoppingRequestId(null);
    conversationRef.current = initialConversationId;
    setHistory(null);
    setPending(null);
    setRetry(null);
    setError(null);
    if (!initialConversationId) {
      setLoading(false);
      return;
    }
    let stale = false;
    setLoading(true);
    void getAssistantHistory(initialConversationId)
      .then((response) => {
        if (!stale) setHistory(response);
      })
      .catch(() => {
        if (!stale) setError("会话加载失败，请确认登录状态和会话归属后重试。");
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [initialConversationId]);

  const saveTurn = useCallback((turn: AssistantTurnResponse) => {
    setHistory((current) =>
      current ? { ...current, turns: mergeTurns(current.turns, [turn]) } : current,
    );
  }, []);

  function isCurrent(version: number) {
    return mounted.current && conversationVersion.current === version;
  }

  async function refresh(before?: string) {
    const id = conversationRef.current;
    if (!id || inFlight.current) return;
    const version = conversationVersion.current;
    setLoading(true);
    try {
      const response = await getAssistantHistory(id, before);
      if (!isCurrent(version)) return;
      setHistory((current) => {
        const known = new Map(current?.turns.map((turn) => [turn.requestId, turn]));
        const turns = response.turns.map((turn) => reconcileTurn(known.get(turn.requestId), turn));
        return {
          ...response,
          turns: before && current ? mergeTurns(turns, current.turns) : turns,
        };
      });
      setError(null);
      if (response.turns.some((turn) => turn.requestId === requestRef.current)) {
        setRetry(null);
        setPending(null);
      }
    } catch {
      if (isCurrent(version)) setError("状态读取失败，请稍后重试。");
    } finally {
      if (isCurrent(version)) setLoading(false);
    }
  }

  async function send(input: string, requestId: string = crypto.randomUUID()) {
    if (inFlight.current || !input.trim()) return;
    const version = conversationVersion.current;
    const isCurrentRequest = () => isCurrent(version) && requestRef.current === requestId;
    inFlight.current = true;
    requestRef.current = requestId;
    setSending(true);
    setError(null);
    setRetry(null);
    setPending({ requestId, input, text: "", lastMessageId: null, toolName: null, started: false });
    try {
      let id = conversationRef.current;
      if (!id) {
        const conversation = await createAssistantConversation();
        id = conversation.id;
        if (!isCurrentRequest()) return;
        conversationRef.current = id;
        createdConversationRef.current = id;
        setHistory({ conversation, turns: [], nextBefore: null });
        onConversationChange(id);
      }
      if (!isCurrentRequest()) return;
      const stream = streamAssistantTurn({
        conversationId: id,
        requestId,
        input,
        onStarted: () => {
          if (isCurrentRequest()) setPending((current) => current && { ...current, started: true });
        },
        onTextDelta: (delta, messageId) => {
          if (isCurrentRequest())
            setPending(
              (current) =>
                current && {
                  ...current,
                  text:
                    current.text +
                    (current.text && current.lastMessageId !== messageId ? "\n\n" : "") +
                    delta,
                  lastMessageId: messageId,
                },
            );
        },
        onToolStart: (toolName) => {
          if (isCurrentRequest()) setPending((current) => current && { ...current, toolName });
        },
      });
      streamRef.current = stream;
      const result = await stream.finished;
      if (!isCurrentRequest()) return;
      try {
        const turn = await getAssistantTurn(id, requestId);
        if (!isCurrentRequest()) return;
        saveTurn(turn);
        setPending(null);
        if (isAssistantTurnActive(turn)) {
          setError("连接已结束，服务端仍在处理。请刷新状态或停止该请求。");
        }
      } catch {
        if (!isCurrentRequest()) return;
        setError(result.error ?? "暂时无法核对请求状态，请使用原请求重试。");
        setRetry({ requestId, input });
      }
    } catch {
      if (isCurrentRequest()) {
        setError("请求未能完成，请确认连接后使用原请求重试。");
        setRetry({ requestId, input });
      }
    } finally {
      if (isCurrentRequest()) {
        inFlight.current = false;
        streamRef.current = null;
        setSending(false);
      }
    }
  }

  const activeTurn = history?.turns.find(isAssistantTurnActive);
  const activeRequestId =
    (pending?.started ? pending.requestId : undefined) ?? activeTurn?.requestId;
  const stopping = stoppingRequestId === activeRequestId;

  async function stop() {
    const id = conversationRef.current;
    const requestId = activeRequestId;
    if (!id || !requestId || stopping) return;
    const version = conversationVersion.current;
    setStoppingRequestId(requestId);
    setError(null);
    try {
      const turn = await stopAssistantTurn(id, requestId);
      if (!isCurrent(version)) return;
      saveTurn(turn);
      if (!isAssistantTurnActive(turn) && requestRef.current === requestId) {
        streamRef.current?.abort();
        setPending(null);
      }
    } catch {
      if (isCurrent(version) && (!requestRef.current || requestRef.current === requestId))
        setError("停止结果尚未确认，请刷新状态后重试。");
    } finally {
      if (isCurrent(version))
        setStoppingRequestId((current) => (current === requestId ? null : current));
    }
  }

  function newConversation() {
    if (inFlight.current || activeTurn) return;
    conversationVersion.current += 1;
    createdConversationRef.current = null;
    requestRef.current = null;
    conversationRef.current = undefined;
    setHistory(null);
    setPending(null);
    setRetry(null);
    setError(null);
    onConversationChange(undefined);
  }

  return {
    history,
    pending,
    loading,
    sending,
    stopping: stopping || activeTurn?.status === "CANCELLING",
    busy: sending || Boolean(activeTurn) || Boolean(retry),
    error,
    retry,
    activeRequestId,
    send,
    stop,
    refresh,
    newConversation,
  };
}

function isAssistantTurnActive(turn: AssistantTurnResponse) {
  return turn.status === "RUNNING" || turn.status === "CANCELLING";
}

function mergeTurns(previous: AssistantTurnResponse[], incoming: AssistantTurnResponse[]) {
  const turns = new Map(previous.map((turn) => [turn.requestId, turn]));
  for (const turn of incoming)
    turns.set(turn.requestId, reconcileTurn(turns.get(turn.requestId), turn));
  return [...turns.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function reconcileTurn(
  previous: AssistantTurnResponse | undefined,
  incoming: AssistantTurnResponse,
) {
  if (
    previous &&
    ((!isAssistantTurnActive(previous) && isAssistantTurnActive(incoming)) ||
      (previous.status === "CANCELLING" && incoming.status === "RUNNING"))
  )
    return previous;
  return incoming;
}

export { isAssistantTurnActive, useAssistantConversation };
