import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const CITATION_HREF = '#sumber-';
const plugins = [remarkGfm];

// "[2]" di luar blok kode diubah jadi tautan agar bisa dirender sebagai penanda sumber.
function linkCitations(text, sourceCount) {
  if (!sourceCount) return text;
  return text
    .split(/(```[\s\S]*?(?:```|$)|`[^`\n]*`)/)
    .map((part, index) =>
      index % 2
        ? part
        : part.replace(/\[(\d{1,2})\](?!\()/g, (match, number) =>
            Number(number) >= 1 && Number(number) <= sourceCount ? `[${number}](${CITATION_HREF}${number})` : match,
          ),
    )
    .join('');
}

export const Markdown = memo(function Markdown({ content, sources = [], onCite, streaming = false }) {
  const components = {
    a({ href = '', children }) {
      if (href.startsWith(CITATION_HREF)) {
        const index = Number(href.slice(CITATION_HREF.length));
        const source = sources[index - 1];
        return (
          <button
            type="button"
            onClick={() => onCite?.(index)}
            title={source ? `${source.title}${source.heading ? ` — ${source.heading}` : ''}` : undefined}
            aria-label={`Lihat sumber ${index}`}
            className="mx-0.5 inline-grid h-[1.15rem] min-w-[1.15rem] -translate-y-px place-items-center rounded-[0.3rem] bg-accent-soft px-1 align-middle text-[0.6875rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-ink"
          >
            {index}
          </button>
        );
      }
      return (
        <a href={href} target="_blank" rel="noreferrer noopener">
          {children}
        </a>
      );
    },
    table({ children }) {
      return (
        <div className="table-wrap">
          <table>{children}</table>
        </div>
      );
    },
  };

  return (
    <div className={streaming ? 'md md-streaming' : 'md'}>
      <ReactMarkdown remarkPlugins={plugins} components={components}>
        {linkCitations(content, sources.length)}
      </ReactMarkdown>
    </div>
  );
});
