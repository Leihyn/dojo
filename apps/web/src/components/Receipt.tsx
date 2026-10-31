/**
 * Evidence cards. Every piece of evidence on Dojo sits on a Slip: a white card with ledger Rows
 * inside and a Stub saying what produced it and when.
 */

export function Slip({ children, className = "", label }: { children: React.ReactNode; className?: string; label?: string }) {
  return (
    <section aria-label={label} className={`min-w-0 rounded-slip border border-line bg-paper shadow-slip ${className}`}>
      {children}
    </section>
  );
}

export function SlipBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

/** A ledger line: label, dotted leader, value. The value is a machine fact, so it is mono and tabular. */
export function Row({ label, children, mark, sub }: { label: React.ReactNode; children: React.ReactNode; mark?: boolean; sub?: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 text-sm text-ink-2">{label}</span>
        <span aria-hidden className="min-w-6 flex-1 -translate-y-1 border-b border-dotted border-rule" />
        <span className={`num shrink-0 text-right text-sm text-ink ${mark ? "mark" : ""}`}>{children}</span>
      </div>
      {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
    </div>
  );
}

/** The stub: what produced this card and when. */
export function Stub({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <footer className="num flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line px-6 py-3 text-xs text-ink-3">
      <span className="min-w-0 break-all">{left}</span>
      {right && <span className="shrink-0">{right}</span>}
    </footer>
  );
}

export function SlipHead({ eyebrow, title, aside }: { eyebrow?: React.ReactNode; title: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 pt-6">
      <div className="min-w-0">
        {eyebrow && <div className="caps">{eyebrow}</div>}
        <h2 className="mt-1 text-xl text-ink">{title}</h2>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}
