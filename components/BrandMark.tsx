/** The Kudi mark: a K whose upper arm ends in a coin. Inline SVG, no image files. */
export function BrandMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Kudi"
      className={className}
    >
      <rect width="40" height="40" rx="11" fill="#232d7a" />
      <g stroke="#fff" strokeWidth="4.4" strokeLinecap="round" fill="none">
        <path d="M13 10.5v19" />
        <path d="M14.8 21.8 25.5 30.5" />
        <path d="M14.8 19.6 24.6 12.6" />
      </g>
      <circle cx="28.4" cy="10.6" r="4.6" fill="#f4b22b" />
      <circle cx="28.4" cy="10.6" r="2.1" fill="none" stroke="#141a4a" strokeOpacity=".35" strokeWidth="1.1" />
    </svg>
  );
}

/** Mark plus the wordmark, set in the display face. */
export function Logo({ size = 34, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <BrandMark size={size} />
      <span className="font-display text-2xl font-bold tracking-tight text-ink">Kudi</span>
    </span>
  );
}
