"use client";

export function PinInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const digits = [0, 1, 2, 3].map((i) => value[i] ?? "");
  return (
    <div className="flex gap-3 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          autoFocus={autoFocus && i === 0}
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9]/g, "");
            const next = (value.slice(0, i) + v + value.slice(i + 1)).slice(
              0,
              4,
            );
            onChange(next);
            if (v) {
              const el = (e.target as HTMLInputElement).parentElement
                ?.children[i + 1] as HTMLInputElement | undefined;
              el?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              const el = (e.target as HTMLInputElement).parentElement
                ?.children[i - 1] as HTMLInputElement | undefined;
              el?.focus();
              onChange(value.slice(0, i - 1));
            }
          }}
          className="serif text-3xl text-center w-14 h-16 bg-card border hairline-strong text-ink focus:outline-none focus:border-brass-deep transition-colors"
          style={{ borderRadius: 2 }}
        />
      ))}
    </div>
  );
}
