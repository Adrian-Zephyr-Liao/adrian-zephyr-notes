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
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<{ requestId: string; input: string } | null>(null);
  const conversationRef = useRef<string | undefined>(undefined);
  const createdConversationRef = useRef<string | null>(null);
  const requestRef = useRef<string | null>(null);
  const streamRef = useRef<ReturnType<typeof streamAssistantTurn> | null>(null);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      streamRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (createdConversationRef.current === initialConversationId) {
      createdConversationRef.current = null;
      return;
    }
    streamRef.current?.abort();
    requestRef.current = null;
    inFlight.current = false;
    setSending(false);
    setStopping(false);
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

  async function refresh(before?: string) {
    const id = conversationRef.current;
    if (!id || inFlight.current) return;
    setLoading(true);
    try {
      const response = await getAssistantHistory(id, before);
      if (conversationRef.current !== id || !mounted.current) return;
      setHistory((current) =>
        before && current
          ? { ...response, turns: mergeTurns(response.turns, current.turns) }
          : response,
      );
      setError(null);
      if (response.turns.some((turn) => turn.requestId === requestRef.current)) {
        setRetry(null);
        setPending(null);
      }
    } catch {
      if (mounted.current && conversationRef.current === id) setError("状态读取失败，请稍后重试。");
    } finally {
      if (mounted.current && conversationRef.current === id) setLoading(false);
    }
  }

  async function send(input: string, requestId: string = crypto.randomUUID()) {
    if (inFlight.current || !input.trim()) return;
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
        if (!mounted.current) return;
        conversationRef.current = id;
        createdConversationRef.current = id;
        setHistory({ conversation, turns: [], nextBefore: null });
        onConversationChange(id);
      }
      if (!mounted.current || requestRef.current !== requestId) return;
      const stream = streamAssistantTurn({
        conversationId: id,
        requestId,
        input,
        onStarted: () => {
          if (mounted.current && requestRef.current === requestId)
            setPending((current) => current && { ...current, started: true });
        },
        onTextDelta: (delta, messageId) => {
          if (mounted.current && requestRef.current === requestId)
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
          if (mounted.current && requestRef.current === requestId)
            setPending((current) => current && { ...current, toolName });
        },
      });
      streamRef.current = stream;
      const result = await stream.finished;
      if (!mounted.current || requestRef.current !== requestId) return;
      try {
        const turn = await getAssistantTurn(id, requestId);
        if (!mounted.current || requestRef.current !== requestId) return;
        saveTurn(turn);
        setPending(null);
        if (isAssistantTurnActive(turn)) {
          setError("连接已结束，服务端仍在处理。请刷新状态或停止该请求。");
        }
      } catch {
        if (!mounted.current || requestRef.current !== requestId) return;
        setError(result.error ?? "暂时无法核对请求状态，请使用原请求重试。");
        setRetry({ requestId, input });
      }
    } catch {
      if (mounted.current) {
        setError("请求未能完成，请确认连接后使用原请求重试。");
        setRetry({ requestId, input });
      }
    } finally {
      if (requestRef.current === requestId) {
        inFlight.current = false;
      }
      if (mounted.current && requestRef.current === requestId) {
        streamRef.current = null;
        setSending(false);
      }
    }
  }

  const activeTurn = history?.turns.find(isAssistantTurnActive);
  const activeRequestId =
    (pending?.started ? pending.requestId : undefined) ?? activeTurn?.requestId;

  async function stop() {
    const id = conversationRef.current;
    if (!id || !activeRequestId || stopping) return;
    setStopping(true);
    setError(null);
    try {
      const turn = await stopAssistantTurn(id, activeRequestId);
      if (!mounted.current || conversationRef.current !== id) return;
      saveTurn(turn);
      if (!isAssistantTurnActive(turn)) {
        streamRef.current?.abort();
        setPending(null);
      }
    } catch {
      if (mounted.current) setError("停止结果尚未确认，请刷新状态后重试。");
    } finally {
      if (mounted.current) setStopping(false);
    }
  }

  function newConversation() {
    if (inFlight.current || activeTurn) return;
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
  for (const turn of incoming) turns.set(turn.requestId, turn);
  return [...turns.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export { isAssistantTurnActive, useAssistantConversation };
