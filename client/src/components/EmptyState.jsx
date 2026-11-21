import { ArrowUpRight } from 'lucide-react';
import { Logo } from './Logo.jsx';

const SUGGESTIONS = [
  { topic: 'Dasar', text: 'Apa itu esports dan bagaimana sejarah singkatnya?' },
  { topic: 'Mobile Legends', text: 'Jelaskan role dan tugas tiap pemain di Mobile Legends.' },
  { topic: 'Format turnamen', text: 'Apa beda single elimination, double elimination, dan Swiss?' },
  { topic: 'Valorant', text: 'Bagaimana sistem ekonomi dan peran agen di Valorant?' },
  { topic: 'Indonesia', text: 'Tim esports Indonesia mana saja yang berprestasi di tingkat dunia?' },
  { topic: 'Karier', text: 'Bagaimana cara menjadi pemain esports profesional?' },
];

export function EmptyState({ onPick }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="animate-rise">
        <Logo className="size-11" />
        <h1 className="mt-6 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
          Tanya apa saja soal <span className="text-accent">esports</span>.
        </h1>
        <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-soft">
          Skie menjawab dari basis pengetahuan esports — game, turnamen, tim, istilah, dan karier — lalu
          menunjukkan sumber yang dipakai untuk tiap jawaban.
        </p>
      </div>

      <ul className="mt-9 grid gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion, index) => (
          <li key={suggestion.text} className="animate-rise" style={{ animationDelay: `${60 + index * 40}ms` }}>
            <button
              type="button"
              onClick={() => onPick(suggestion.text)}
              className="group flex h-full w-full items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-accent/50 hover:bg-raised"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.6875rem] font-medium tracking-wider text-accent uppercase">
                  {suggestion.topic}
                </span>
                <span className="mt-1 block text-sm leading-snug text-ink">{suggestion.text}</span>
              </span>
              <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-faint transition-colors group-hover:text-accent" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
