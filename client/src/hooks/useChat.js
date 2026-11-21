import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../lib/api.js';

let localId = 0;
const nextId = () => `local-${++localId}`;

export function useChat() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | loading | streaming
  const [loadError, setLoadError] = useState(null);
  const abortRef = useRef(null);
  const runRef = useRef(0);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch (error) {
      setLoadError(error.message);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .listConversations()
      .then((list) => !cancelled && setConversations(list))
      .catch((error) => !cancelled && setLoadError(error.message));
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, []);

  const cancelRun = useCallback(() => {
    runRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const newChat = useCallback(() => {
    cancelRun();
    setActiveId(null);
    setMessages([]);
    setStatus('idle');
    setLoadError(null);
  }, [cancelRun]);

  const selectConversation = useCallback(
    async (id) => {
      cancelRun();
      const run = runRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setActiveId(id);
      setMessages([]);
      setLoadError(null);
      setStatus('loading');
      try {
        const data = await api.getConversation(id, { signal: controller.signal });
        if (runRef.current !== run) return;
        setMessages(data.messages);
      } catch (error) {
        if (runRef.current !== run || error.name === 'AbortError') return;
        setLoadError(error.message);
      }
      setStatus('idle');
    },
    [cancelRun],
  );

  const removeConversation = useCallback(
    async (id) => {
      try {
        await api.deleteConversation(id);
      } catch (error) {
        setLoadError(error.message);
        return;
      }
      setConversations((list) => list.filter((item) => item.id !== id));
      if (id === activeId) newChat();
    },
    [activeId, newChat],
  );

  const send = useCallback(
    async (text, { retry = false } = {}) => {
      const message = text.trim();
      if (!message || status !== 'idle') return;

      cancelRun();
      const run = runRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      const replyId = nextId();
      const patchReply = (patch) =>
        setMessages((list) =>
          list.map((item) => (item.id === replyId ? { ...item, ...patch(item) } : item)),
        );

      setLoadError(null);
      setMessages((list) => [
        // Saat mencoba lagi, pasangan pertanyaan-jawaban yang gagal diganti, bukan ditumpuk.
        ...(retry ? list.slice(0, list.findLastIndex((item) => item.role === 'user')) : list),
        { id: nextId(), role: 'user', content: message, sources: [] },
        { id: replyId, role: 'assistant', content: '', sources: [], pending: true },
      ]);
      setStatus('streaming');

      let conversationId = activeId;
      try {
        for await (const { event, data } of api.streamChat({
          message,
          conversationId,
          signal: controller.signal,
        })) {
          if (runRef.current !== run) return;
          if (event === 'meta') {
            conversationId = data.conversationId;
            setActiveId(data.conversationId);
            setConversations((list) => [
              { id: data.conversationId, title: data.title, updatedAt: new Date().toISOString() },
              ...list.filter((item) => item.id !== data.conversationId),
            ]);
            patchReply(() => ({ sources: data.sources }));
          } else if (event === 'token') {
            patchReply((item) => ({ content: item.content + data.text }));
          } else if (event === 'error') {
            patchReply(() => ({ error: data.message }));
          }
        }
      } catch (error) {
        if (runRef.current !== run) return;
        if (error.name === 'AbortError') patchReply(() => ({ stopped: true }));
        else patchReply(() => ({ error: error.message }));
      }
      if (runRef.current !== run) return;
      patchReply((item) => ({
        pending: false,
        error: item.error ?? (!item.content && !item.stopped ? 'Server tidak mengirim jawaban.' : undefined),
      }));
      abortRef.current = null;
      setStatus('idle');
    },
    [activeId, cancelRun, status],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return {
    conversations,
    activeId,
    messages,
    status,
    loadError,
    send,
    stop,
    newChat,
    selectConversation,
    removeConversation,
    refreshConversations,
  };
}
