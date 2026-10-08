export function Logo({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path
        d="M16 7.5a8.5 8.5 0 0 0-7.4 12.7L7.5 24.5l4.4-1.1A8.5 8.5 0 1 0 16 7.5Z"
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M16 11.5V16l3 1.8"
        fill="none"
        stroke="var(--accent-text)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
