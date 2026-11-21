import { Menu, Moon, Plus, Sun } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Composer } from './components/Composer.jsx';
import { EmptyState } from './components/EmptyState.jsx';
import { IconButton } from './components/IconButton.jsx';
import { Message } from './components/Message.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { useChat } from './hooks/useChat.js';
import { useTheme } from './hooks/useTheme.js';
import { getHealth } from './lib/api.js';

function Banner({ tone = 'danger', children }) {
  return (
    <div
      role="status"
      className={`mx-auto mt-3 w-[calc(100%-1.5rem)] max-w-3xl rounded-xl border px-4 py-2.5 text-sm leading-relaxed sm:w-[calc(100%-3rem)] ${
        tone === 'danger' ? 'border-danger/30 bg-danger-soft' : 'border-line bg-surface text-soft'
      }`}
    >
      {children}
    </div>
  );
}

export default function App() {
  const chat = useChat();
  const { theme, toggle } = useTheme();
  const [draft, setDraft] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((data) => !cancelled && setHealth(data))
      .catch(() => !cancelled && setHealth({ ok: false, llm: { configured: false } }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && setSidebarOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element && stickRef.current) element.scrollTop = element.scrollHeight;
  }, [chat.messages]);

  const onScroll = () => {
    const element = scrollRef.current;
    stickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
  };

  const { send, newChat, selectConversation, removeConversation } = chat;

  const submit = useCallback(
    (text, options) => {
      stickRef.current = true;
      setDraft('');
      send(text, options);
    },
    [send],
  );

  const startNew = () => {
    newChat();
    setDraft('');
    setSidebarOpen(false);
  };

  const select = (id) => {
    stickRef.current = true;
    setSidebarOpen(false);
    if (id !== chat.activeId) selectConversation(id);
  };

  const remove = (conversation) => {
    if (window.confirm(`Hapus percakapan "${conversation.title}"?`)) removeConversation(conversation.id);
  };

  const lastUserMessage = chat.messages.findLast((message) => message.role === 'user');
  const retry = useCallback(() => lastUserMessage && send(lastUserMessage.content, { retry: true }), [lastUserMessage, send]);

  const title = chat.conversations.find((item) => item.id === chat.activeId)?.title;
  const streaming = chat.status === 'streaming';
  const isEmpty = chat.messages.length === 0 && chat.status === 'idle' && !chat.loadError;

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-ink">
      <Sidebar
        conversations={chat.conversations}
        activeId={chat.activeId}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNew={startNew}
        onSelect={select}
        onDelete={remove}
        theme={theme}
        onToggleTheme={toggle}
        health={health}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-2 sm:px-4 md:border-transparent">
          <IconButton label="Buka menu" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="size-[1.125rem]" />
          </IconButton>
          <h1 className="min-w-0 flex-1 truncate px-2 text-sm font-medium text-soft">
            {title ?? 'Percakapan baru'}
          </h1>
          <IconButton label="Percakapan baru" className="md:hidden" onClick={startNew}>
            <Plus className="size-[1.125rem]" />
          </IconButton>
          <IconButton
            label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
            className="md:hidden"
            onClick={toggle}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
        </header>

        {health && !health.ok && (
          <Banner>Server atau database tidak terjangkau. Pastikan backend dan MySQL sedang berjalan.</Banner>
        )}
        {health?.ok && !health.llm.configured && (
          <Banner>
            LLM belum dikonfigurasi. Isi <code className="font-mono text-[0.8125rem]">LLM_API_KEY</code> di berkas{' '}
            <code className="font-mono text-[0.8125rem]">.env</code> lalu jalankan ulang server.
          </Banner>
        )}
        {health?.ok && health.knowledgeChunks === 0 && (
          <Banner>
            Basis pengetahuan masih kosong. Jalankan{' '}
            <code className="font-mono text-[0.8125rem]">npm run ingest</code>.
          </Banner>
        )}
        {chat.loadError && <Banner>{chat.loadError}</Banner>}

        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          {isEmpty ? (
            <EmptyState onPick={(text) => submit(text)} />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pt-6 pb-10 sm:px-6" aria-live="polite">
              {chat.status === 'loading' && <p className="text-sm text-faint">Memuat percakapan…</p>}
              {chat.messages.map((message, index) => (
                <Message
                  key={message.id}
                  message={message}
                  onRetry={message.error && index === chat.messages.length - 1 && !streaming ? retry : undefined}
                />
              ))}
            </div>
          )}
        </div>

        <Composer
          value={draft}
          onChange={setDraft}
          onSubmit={(text) => submit(text)}
          onStop={chat.stop}
          streaming={streaming}
          disabled={chat.status === 'loading'}
          focusKey={chat.activeId ?? 'new'}
        />
      </main>
    </div>
  );
}
