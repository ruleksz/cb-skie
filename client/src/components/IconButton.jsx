export function IconButton({ label, className = '', children, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-grid size-9 shrink-0 place-items-center rounded-lg text-soft transition-colors hover:bg-raised hover:text-ink disabled:opacity-40 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
