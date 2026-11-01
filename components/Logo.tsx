/** Tanda mark: a capsule (white + amber) on brand green. Original artwork. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect width="48" height="48" rx="12" fill="#0b5d4b" />
      <g transform="rotate(-40 24 24)">
        <rect x="8" y="17" width="32" height="14" rx="7" fill="#ffffff" />
        <path d="M24 17h9a7 7 0 0 1 0 14h-9z" fill="#f2b84b" />
        <rect x="8" y="17" width="32" height="14" rx="7" fill="none" stroke="#08463a" strokeWidth="1.5" />
      </g>
    </svg>
  );
}
