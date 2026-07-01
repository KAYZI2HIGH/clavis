export function KeyArt() {
  return (
    <svg
      width="160"
      height="44"
      viewBox="0 0 160 44"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id="brassG" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.10 80)" />
          <stop offset="50%" stopColor="oklch(0.68 0.10 75)" />
          <stop offset="100%" stopColor="oklch(0.45 0.09 60)" />
        </linearGradient>
      </defs>
      <circle
        cx="22"
        cy="22"
        r="18"
        fill="url(#brassG)"
        stroke="oklch(0.35 0.07 55)"
        strokeWidth="1"
      />
      <circle cx="22" cy="22" r="6" fill="oklch(0.20 0.012 60)" />
      <rect
        x="40"
        y="19"
        width="100"
        height="6"
        fill="url(#brassG)"
        stroke="oklch(0.35 0.07 55)"
        strokeWidth="0.6"
      />
      <path
        d="M120 25 L120 32 L126 32 L126 28 L132 28 L132 32 L138 32 L138 25 Z"
        fill="url(#brassG)"
        stroke="oklch(0.35 0.07 55)"
        strokeWidth="0.6"
      />
    </svg>
  );
}
