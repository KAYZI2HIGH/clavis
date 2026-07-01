export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls =
    size === "lg" ? "text-4xl"
    : size === "sm" ? "text-lg"
    : "text-2xl";
  return (
    <p
      className={`serif ${cls} text-ink tracking-tight`}
      style={{ letterSpacing: "0.02em" }}
    >
      Clavis
    </p>
  );
}
