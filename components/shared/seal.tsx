export function Seal({
  quorum,
  total,
}: {
  quorum: number;
  total: number;
}) {
  return (
    <svg width="84" height="84" viewBox="0 0 100 100">
      <circle
        cx="50"
        cy="50"
        r="44"
        fill="none"
        stroke="var(--brass-deep)"
        strokeWidth="1.5"
      />
      <circle
        cx="50"
        cy="50"
        r="38"
        fill="none"
        stroke="var(--brass-deep)"
        strokeWidth="0.8"
      />
      <text
        x="50"
        y="44"
        textAnchor="middle"
        fill="var(--brass-deep)"
        style={{ font: "600 8px Inter", letterSpacing: "0.18em" }}
      >
        SEALED
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fill="var(--brass-deep)"
        style={{ font: "400 6px Inter", letterSpacing: "0.14em" }}
      >
        {quorum} OF {total} KEYS
      </text>
      <path d="M30 70 L70 70" stroke="var(--brass-deep)" strokeWidth="0.6" />
    </svg>
  );
}
