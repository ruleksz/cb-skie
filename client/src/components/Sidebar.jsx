import { Moon, Plus, Sun, Trash2, X } from 'lucide-react';
import { IconButton } from './IconButton.jsx';
import { Logo } from './Logo.jsx';

const DAY = 86_400_000;

function groupByAge(conversations) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const groups = [
    { label: 'Hari ini', items: [] },
    { label: '7 hari terakhir', items: [] },
    { label: 'Lebih lama', items: [] },
  ];
  for (const conversation of conversations) {
    const time = new Date(conversation.updatedAt).getTime();
    const index = time >= startOfToday ? 0 : time >= startOfToday - 7 * DAY ? 1 : 2;
    groups[index].items.push(conversation);
  }
  return groups.filter((group) => group.items.length);
}

export function Sidebar({
  conversations,
  activeId,
  open,
  onClose,
  onNew,
  onSelect,
  onDelete,
  theme,
  onToggleTheme,
  health,
}) {
  const groups = groupByAge(conversations);

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Riwayat percakapan"
      >
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          <Logo />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="font-display text-[0.95rem] font-semibold tracking-tight">Skie</p>
            <p className="text-xs text-faint">Asisten esports</p>
          </div>
          <IconButton label="Tutup menu" className="md:hidden" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-medium transition-colors hover:border-accent/50 hover:bg-raised"
          >
            <Plus className="size-4 text-accent" />
            Percakapan baru
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          {groups.length === 0 ? (
            <p className="px-2 pt-6 text-sm leading-relaxed text-faint">
              Belum ada percakapan. Pertanyaan pertama Anda akan tersimpan di sini.
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="pt-4">
                <h2 className="px-2 pb-1.5 text-[0.6875rem] font-medium tracking-wider text-faint uppercase">
                  {group.label}
                </h2>
                <ul className="space-y-0.5">
                  {group.items.map((conversation) => {
                    const active = conversation.id === activeId;
                    return (
                      <li key={conversation.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => onSelect(conversation.id)}
                          aria-current={active ? 'page' : undefined}
                          className={`w-full truncate rounded-lg py-2 pr-9 pl-2.5 text-left text-sm transition-colors ${
                            active ? 'bg-raised text-ink' : 'text-soft hover:bg-raised/60 hover:text-ink'
                          }`}
                        >
                          {conversation.title}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(conversation)}
                          aria-label={`Hapus percakapan "${conversation.title}"`}
                          title="Hapus"
                          className="absolute top-1/2 right-1 grid size-7 -translate-y-1/2 place-items-center rounded-md text-faint opacity-0 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </nav>

        <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
          <div className="min-w-0 flex-1 px-1">
            <p className="flex items-center gap-1.5 text-xs text-soft">
              <span
                className={`size-1.5 rounded-full ${
                  health == null ? 'bg-faint' : health.ok && health.llm.configured ? 'bg-accent' : 'bg-danger'
                }`}
              />
              <span className="truncate">
                {health == null
                  ? 'Memeriksa server…'
                  : !health.ok
                    ? 'Server tidak terjangkau'
                    : health.llm.configured
                      ? health.llm.model
                      : 'LLM belum dikonfigurasi'}
              </span>
            </p>
            {health?.ok && (
              <p className="truncate pl-3 text-[0.6875rem] text-faint">
                {health.knowledgeChunks} potongan pengetahuan
              </p>
            )}
          </div>
          <IconButton
            label={theme === 'dark' ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
        </div>
      </aside>
    </>
  );
}
