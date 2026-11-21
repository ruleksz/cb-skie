export function Logo({ className = 'size-8' }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-[0.6rem] border border-line bg-raised ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-[72%]">
        <path
          d="M21 10.5h-7a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          className="text-accent"
        />
      </svg>
    </span>
  );
}
