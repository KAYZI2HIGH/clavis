export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="engraved">{label}</label>
        {hint && <span className="engraved text-ink-faint">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
