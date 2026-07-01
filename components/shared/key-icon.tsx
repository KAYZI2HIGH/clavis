export function KeyIcon({
  filled,
  outlined,
}: {
  filled?: boolean;
  outlined?: boolean;
}) {
  const stroke =
    outlined ? "var(--brass-deep)"
    : filled ? "var(--brass-deep)"
    : "var(--ink-faint)";
  const fill = filled && !outlined ? "var(--brass)" : "none";
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle
        cx="8"
        cy="12"
        r="4"
        stroke={stroke}
        strokeWidth="1.6"
        fill={fill}
      />
      <path
        d="M12 12h9M18 12v3M21 12v3"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="square"
      />
    </svg>
  );
}
