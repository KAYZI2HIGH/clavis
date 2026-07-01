export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between border-b hairline pb-3">
      <p className="engraved">{label}</p>
      <div>{value}</div>
    </div>
  );
}
