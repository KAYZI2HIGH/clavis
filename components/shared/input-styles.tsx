export function InputStyles() {
  return (
    <style>{`
      .input-mech {
        width: 100%;
        height: 38px;
        padding: 0 12px;
        background: var(--paper);
        border: 1px solid var(--rule-strong);
        border-radius: 2px;
        font-size: 14px;
        color: var(--ink);
        outline: none;
        transition: border-color 160ms var(--ease-mech);
      }
      .input-mech:focus { border-color: var(--brass-deep); }
      .input-mech::placeholder { color: var(--ink-faint); }
      .input-mech:disabled { opacity: 0.5; }
    `}</style>
  );
}
