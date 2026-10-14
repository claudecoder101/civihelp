import { Icon, pct } from '../ui'

/* Reasons as chips; a cross-language reason is the product's headline feature, so it gets its own accent. */
export function ReasonChips({ reasons = [] }) {
  if (!reasons.length) return null
  return (
    <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Reasons">
      {reasons.map(x => /cross-language|tamil/i.test(x)
        ? <li key={x} className="inline-flex items-center gap-1.5 rounded-md bg-[#0b1a36] px-2 py-1 text-[13px] font-semibold text-white shadow-[0_4px_14px_-6px_rgba(194,90,0,.7)] ring-1 ring-[#ff9933]/60">
            <span className="font-mono text-[11px] text-[#ffb366]" aria-hidden>அ↔A</span>{x}
          </li>
        : <li key={x} className="rounded-md bg-card px-2 py-1 text-[13px] text-ink ring-1 ring-line">{x}</li>)}
    </ul>
  )
}

/* Thin score bar with the number beside it. */
export function Meter({ value, label, className = '' }) {
  const w = Math.max(0, Math.min(1, value ?? 0)) * 100
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="w-12 shrink-0 text-[12px] text-ink-2">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10" role="img" aria-label={`${label} ${pct(value)}`}>
        <span className="block h-full rounded-full bg-navy" style={{ width: `${w}%` }} />
      </span>
      <span className="w-11 shrink-0 text-right font-mono text-[13px] font-semibold">{pct(value)}</span>
    </div>
  )
}

/* Small section card used across the workbench. */
export function Card({ title, sub, eyebrow, children, className = '', icon, ...rest }) {
  return (
    <section data-enter className={`rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-6 ${className}`} {...rest}>
      {eyebrow && <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">{eyebrow}</p>}
      {title && <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">{icon && <Icon name={icon} className="size-5 text-navy" />}{title}</h2>}
      {sub && <p className="mb-4 mt-0.5 text-[14.5px] text-ink-2 [text-wrap:pretty]">{sub}</p>}
      {children}
    </section>
  )
}
