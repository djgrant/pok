interface IconProps {
  size?: number;
  className?: string;
}

/**
 * Refresh/Reset icon - circular arrows indicating reload
 */
export function RefreshIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path d="M1 8a7 7 0 0 1 7-7 7 7 0 0 1 5.5 2.67" />
      <polyline points="14 2 14 6 10 6" />
      <path d="M15 8a7 7 0 0 1-7 7 7 7 0 0 1-5.5-2.67" />
      <polyline points="2 14 2 10 6 10" />
    </svg>
  );
}

/**
 * Alert/Error icon - circle with exclamation mark
 */
export function AlertIcon({ size = 64, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <circle cx="32" cy="32" r="28" />
      <line x1="32" y1="20" x2="32" y2="36" />
      <circle cx="32" cy="44" r="2" fill="currentColor" />
    </svg>
  );
}
