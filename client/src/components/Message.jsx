import { AlertCircle, Check, Copy } from 'lucide-react';
import { memo, useCallback, useId, useState } from 'react';
import { Logo } from './Logo.jsx';
import { Markdown } from './Markdown.jsx';
import { Sources } from './Sources.jsx';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // papan klip tidak tersedia
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-faint transition-colors hover:bg-raised hover:text-ink"
    >
      {copied ? <Check className="size-3.5 text-accent" /> : <Copy className="size-3.5" />}
      {copied ? 'Tersalin' : 'Salin'}
    </button>
  );
}

function Thinking({ label }) {
  return (
    <p className="flex items-center gap-2.5 py-1 text-sm text-faint" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="size-1.5 animate-pulse rounded-full bg-accent"
            style={{ animationDelay: `${dot * 160}ms` }}
          />
        ))}
      </span>
      {label}
    </p>
  );
}

export const Message = memo(function Message({ message, onRetry }) {
  const idPrefix = useId();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(null);

  const cite = useCallback(
    (index) => {
      setSourcesOpen(true);
      setHighlighted(index);
      requestAnimationFrame(() =>
        document.getElementById(`${idPrefix}-${index}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      );
    },
    [idPrefix],
  );

  if (message.role === 'user') {
    return (
      <div className="flex animate-rise justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-raised px-4 py-2.5 text-[0.9375rem] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {message.content}
        </div>
      </div>
    );
  }

  const sources = message.sources ?? [];
  return (
    <div className="flex animate-rise gap-3 sm:gap-4">
      <Logo className="mt-0.5 size-7" />
      <div className="min-w-0 flex-1">
        {message.pending && !message.content && !message.error && (
          <Thinking label={sources.length ? 'Menyusun jawaban…' : 'Mencari di basis pengetahuan…'} />
        )}

        {message.content && (
          <Markdown content={message.content} sources={sources} onCite={cite} streaming={message.pending} />
        )}

        {message.stopped && (
          <p className="mt-2 text-xs text-faint">{message.content ? 'Jawaban dihentikan.' : 'Dibatalkan.'}</p>
        )}

        {message.error && (
          <div
            role="alert"
            className="mt-2 flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed [overflow-wrap:anywhere]">{message.error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-1.5 text-xs font-medium text-danger underline underline-offset-2"
                >
                  Coba lagi
                </button>
              )}
            </div>
          </div>
        )}

        {!message.pending && message.content && (
          <>
            <Sources
              sources={sources}
              open={sourcesOpen}
              onToggle={() => setSourcesOpen((value) => !value)}
              highlighted={highlighted}
              idPrefix={idPrefix}
            />
            <div className="mt-2 -ml-1.5">
              <CopyButton text={message.content} />
            </div>
          </>
        )}
      </div>
    </div>
  );
});
