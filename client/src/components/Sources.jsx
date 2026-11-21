import { BookOpen, ChevronDown } from 'lucide-react';

// Kutipan berasal dari Markdown mentah; sintaks tabel dan penekanan dibuang agar enak dibaca.
function toPlainText(markdown) {
  return markdown
    .replace(/\|\s+\|/g, '|\n|')
    .replace(/^\s*\|?[\s:|-]*-{3,}[\s:|-]*\|?\s*$/gm, '')
    .replace(/^\s*\|\s*|\s*\|\s*$/gm, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/(\*\*|__|`)/g, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\s*\n+\s*/g, ' ')
    .trim();
}

export function Sources({ sources, open, onToggle, highlighted, idPrefix }) {
  if (!sources.length) return null;
  const titles = [...new Set(sources.map((source) => source.title))];

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${idPrefix}-list`}
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-line py-1 pr-2 pl-2.5 text-xs text-soft transition-colors hover:border-accent/50 hover:text-ink"
      >
        <BookOpen className="size-3.5 shrink-0 text-accent" />
        <span className="shrink-0 font-medium">{sources.length} sumber</span>
        <span className="truncate text-faint">{titles.join(' · ')}</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ol id={`${idPrefix}-list`} className="mt-2.5 grid gap-2 sm:grid-cols-2">
          {sources.map((source) => (
            <li
              key={source.index}
              id={`${idPrefix}-${source.index}`}
              className={`animate-rise rounded-xl border bg-surface p-3 transition-colors ${
                highlighted === source.index ? 'border-accent' : 'border-line'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-px inline-grid size-[1.15rem] shrink-0 place-items-center rounded-[0.3rem] bg-accent-soft text-[0.6875rem] font-semibold text-accent">
                  {source.index}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">{source.title}</p>
                  {source.heading && <p className="truncate text-xs text-faint">{source.heading}</p>}
                </div>
                <span
                  className="shrink-0 text-[0.6875rem] text-faint tabular-nums"
                  title="Kemiripan dengan pertanyaan"
                >
                  {Math.round(source.score * 100)}%
                </span>
              </div>
              <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-soft">{toPlainText(source.excerpt)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
