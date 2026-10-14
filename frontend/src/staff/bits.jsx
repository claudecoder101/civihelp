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
    <section data-enter className={`min-w-0 rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-6 ${className}`} {...rest}>
      {eyebrow && <p className="mb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-2">{eyebrow}</p>}
      {title && <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">{icon && <Icon name={icon} className="size-5 text-navy" />}{title}</h2>}
      {sub && <p className="mb-4 mt-0.5 text-[14.5px] text-ink-2 [text-wrap:pretty]">{sub}</p>}
      {children}
    </section>
  )
}

/* Why these reports are one issue: the anchor report vs each linked report, scored by the multilingual model.
   No translation — the model compares meaning across Tamil and English directly. */
export function AiMatchPanel({ m }) {
  if (!m) return null
  const cross = m.pairs.filter(p => p.cross_language).length
  return (
    <section data-enter className="overflow-hidden rounded-xl bg-[#0b1a36] text-white shadow-[0_18px_40px_-20px_rgba(11,26,54,.7)]">
      <div className="flex flex-wrap items-center gap-2 px-5 pt-5 sm:px-6">
        <span className="rounded-md bg-white/10 px-2 py-1 font-mono text-[12px] text-[#ffb366]">அ↔A</span>
        <h2 className="text-lg font-bold">AI merged {m.pairs.length + 1} reports into this issue</h2>
        {cross > 0 && <span className="rounded-full bg-[#ff9933] px-2.5 py-0.5 text-[12px] font-bold text-[#0b1a36]">{cross} cross-language</span>}
      </div>
      <p className="px-5 pt-1 text-[14px] text-white/65 sm:px-6">Model: <span className="font-mono">{m.model}</span> — compares meaning across Tamil and English directly, no translation. Every reporter follows this one issue and gets every update.</p>
      <ul className="mt-4 space-y-3 px-5 pb-5 sm:px-6">
        {m.pairs.map(p => (
          <li key={p.id} className="grid gap-2 rounded-lg bg-white/[.06] p-3 ring-1 ring-white/10 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <p className={`${m.anchor.tamil ? 'ta' : ''} text-[14.5px]`}><span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-white/50">{m.anchor.id} · {m.anchor.tamil ? 'Tamil' : 'English'}</span>“{m.anchor.text}”</p>
            <div className="flex flex-row items-center justify-center gap-3 md:flex-col md:gap-1">
              <span className={`rounded-full px-3 py-1 text-[15px] font-extrabold tnum ${p.meaning >= 0.75 ? 'bg-[#2fbf4a] text-[#05210c]' : p.meaning >= 0.5 ? 'bg-[#ffb366] text-[#3a1d00]' : 'bg-white/15'}`}>{Math.round(p.meaning * 100)}%</span>
              <span className="text-[12px] text-white/60">{p.distance_m} m · {p.hours} h apart</span>
            </div>
            <p className={`${p.tamil ? 'ta' : ''} text-[14.5px]`}><span className="mb-0.5 block text-[11px] font-bold uppercase tracking-wider text-white/50">{p.id} · {p.tamil ? 'Tamil' : 'English'}</span>“{p.text}”</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
