import { ArrowUp, Square } from 'lucide-react';
import { useEffect, useRef } from 'react';

const MAX_LENGTH = 2000;
const MAX_HEIGHT = 200;

export function Composer({ value, onChange, onSubmit, onStop, streaming, disabled, focusKey }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
    element.style.overflowY = element.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden';
  }, [value]);

  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) ref.current?.focus();
  }, [focusKey]);

  const tooLong = value.length > MAX_LENGTH;
  const canSend = value.trim().length > 0 && !tooLong && !disabled && !streaming;

  const submit = (event) => {
    event.preventDefault();
    if (canSend) onSubmit(value);
  };

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl px-3 pb-3 sm:px-6 sm:pb-4">
      <div className="rounded-3xl border border-line bg-surface shadow-[0_8px_30px_-18px_rgb(0_0_0/0.5)] transition-colors focus-within:border-accent/60">
        <label htmlFor="composer" className="sr-only">
          Pertanyaan
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
          }}
          placeholder="Tanyakan sesuatu tentang esports…"
          className="block w-full resize-none bg-transparent px-5 pt-4 pb-1 text-[0.9375rem] leading-relaxed outline-none placeholder:text-faint"
        />
        <div className="flex items-center gap-3 py-2 pr-2 pl-5">
          <p className={`flex-1 text-xs tabular-nums ${tooLong ? 'text-danger' : 'text-faint'}`}>
            {value.length > MAX_LENGTH * 0.8 ? (
              `${value.length} / ${MAX_LENGTH}`
            ) : (
              <span className="max-sm:hidden">Enter untuk kirim · Shift + Enter baris baru</span>
            )}
          </p>
          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Hentikan jawaban"
              title="Hentikan"
              className="grid size-9 place-items-center rounded-full bg-raised text-ink transition-colors hover:bg-line"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSend}
              aria-label="Kirim"
              title="Kirim"
              className="grid size-9 place-items-center rounded-full bg-accent text-accent-ink transition-opacity hover:opacity-90 disabled:bg-raised disabled:text-faint"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[0.6875rem] text-faint">
        Jawaban disusun dari basis pengetahuan Skie. Hasil pertandingan dan roster terbaru bisa berbeda.
      </p>
    </form>
  );
}
