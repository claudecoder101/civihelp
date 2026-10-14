import { useState } from 'react'
import { CountUp, useStagger } from '../anim'
import { ErrorBox, Loading, fmtTime, useApi, useLang } from '../ui'

const pctFmt = v => `${Math.round(v)}%`
const sorts = {
  overdue: (a, b) => b.overdue - a.overdue || b.open - a.open,
  resolve: (a, b) => (b.median_resolve_h ?? -1) - (a.median_resolve_h ?? -1),
  verified: (a, b) => a.verified_rate - b.verified_rate,
}

export default function Board() {
  const { t } = useLang()
  const { data, error, loading, reload } = useApi('/api/public/board')
  const [sort, setSort] = useState('overdue')
  const scope = useStagger([!!data])

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!data) return null
  const { totals } = data
  const gap = Math.max(0, Math.round((totals.closure_rate - totals.verified_rate) * 100))
  const depts = [...data.departments].sort(sorts[sort])
  const maxCat = Math.max(1, ...data.categories.map(c => c.open))

  return (
    <div ref={scope}>
      <header data-stagger className="max-w-3xl">
        <p className="eyebrow ta">{data.city} · {t.updated} {fmtTime(data.generated_at)}</p>
        <h1 className="ta mt-1 text-[clamp(1.8rem,3.4vw,2.55rem)] font-bold leading-[1.05]">{t.boardTitle}</h1>
        <p className="ta mt-3 text-lg text-ink-2">{t.boardLede}</p>
      </header>

      {/* Headline: what departments claim vs what citizens confirmed */}
      <section data-stagger className="card mt-6 overflow-hidden" aria-labelledby="gap-h">
        <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_1.3fr] md:items-center">
          <div>
            <h2 id="gap-h" className="ta text-xl font-bold">{t.gapTitle}</h2>
            <p className="ta mt-2 text-ink-2">{t.gapNote(gap)}</p>
          </div>
          <div className="space-y-4">
            {[[t.closedRate, totals.closure_rate, 'bg-navy'], [t.verifiedRate, totals.verified_rate, 'bg-ok']].map(([label, v, color]) => (
              <div key={label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="ta font-semibold">{label}</span>
                  <CountUp value={v * 100} format={pctFmt} className="display text-4xl font-bold tnum" />
                </div>
                <div className="bar mt-1.5 h-3 overflow-hidden rounded-full" aria-hidden>
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${v * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <dl data-stagger className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line/70 md:grid-cols-5">
        {[[t.reports, totals.reports], [t.issues, totals.issues], [t.open, totals.open], [t.overdue, totals.overdue, true]].map(([label, v, bad]) => (
          <div key={label} className="bg-card p-4">
            <dt className="ta text-sm text-ink-2">{label}</dt>
            <dd><CountUp value={v} className={`display text-3xl font-bold tnum ${bad ? 'text-bad' : ''}`} /></dd>
          </div>
        ))}
        <div className="col-span-2 bg-card p-4 md:col-span-1">
          <dt className="ta text-sm text-ink-2">{t.medianResolve}</dt>
          <dd className="display text-3xl font-bold tnum">{totals.median_resolve_h == null ? '—' : <CountUp value={totals.median_resolve_h} format={v => t.hours(v)} />}</dd>
        </div>
      </dl>

      <section data-stagger className="card mt-6 p-5 sm:p-6" aria-labelledby="lb-h">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="lb-h" className="ta text-xl font-bold">{t.leaderboard}</h2>
          <div role="group" aria-label={t.sortBy} className="flex flex-wrap gap-1 rounded-md bg-sunk p-0.5 md:ml-auto">
            {[['overdue', t.sortOverdue], ['resolve', t.sortResolve], ['verified', t.sortVerified]].map(([k, label]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}
                className={`ta min-h-9 rounded px-3 text-sm font-semibold transition-colors ${sort === k ? 'bg-card text-navy shadow-sm' : 'text-ink-2 hover:text-ink'}`}>{label}</button>
            ))}
          </div>
        </div>
        <ol className="mt-4 divide-y divide-line">
          {depts.map((d, i) => (
            <li key={d.dept_id} className="grid gap-3 py-4 md:grid-cols-[2rem_minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] md:items-center">
              <span className="display text-lg font-bold text-ink-2 tnum max-md:hidden">{i + 1}</span>
              <div className="min-w-0">
                <p className="display text-lg font-bold leading-tight"><span className="text-ink-2 md:hidden">{i + 1}. </span>{d.dept_name}</p>
                <p className="ta text-[13px] text-ink-2">{t.open} {d.open} · {t.resolved} {d.resolved} · {t.bounces} {d.bounces}</p>
              </div>
              <dl className="contents max-md:grid max-md:grid-cols-2 max-md:gap-3">
                <Stat label={t.overdue} value={d.overdue} tone={d.overdue ? 'text-bad' : ''} hl={sort === 'overdue'} />
                <Stat label={t.medianResolve} value={t.hours(d.median_resolve_h)} hl={sort === 'resolve'} />
                <Stat label={t.ack} value={t.hours(d.median_ack_h)} />
                <div className={`min-w-0 rounded-md px-2 py-1 ${sort === 'verified' ? 'bg-navy-soft' : ''}`}>
                  <dt className="ta text-[12px] text-ink-2">{t.closedRate} / {t.verifiedRate}</dt>
                  <dd className="tnum font-bold">{Math.round(d.closure_rate * 100)}% <span className="text-ok">/ {Math.round(d.verified_rate * 100)}%</span></dd>
                  <div className="bar relative mt-1 h-1.5 rounded-full" aria-hidden>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-navy/35" style={{ width: `${d.closure_rate * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-ok" style={{ width: `${d.verified_rate * 100}%` }} />
                  </div>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      </section>

      <section data-stagger className="card mt-6 p-5 sm:p-6" aria-labelledby="cat-h">
        <h2 id="cat-h" className="ta text-xl font-bold">{t.byCategory}</h2>
        <ul className="mt-4 space-y-3">
          {data.categories.map(c => (
            <li key={c.category} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_auto]">
              <span className="truncate font-semibold">{c.name}</span>
              <div className="bar relative h-3 rounded-full" aria-hidden>
                <div className="absolute inset-y-0 left-0 rounded-full bg-navy/30" style={{ width: `${(c.open / maxCat) * 100}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-bad" style={{ width: `${(c.overdue / maxCat) * 100}%` }} />
              </div>
              <span className="ta whitespace-nowrap tnum text-ink-2">{c.open} {t.open} · <span className="text-bad">{c.overdue} {t.overdue}</span></span>
            </li>
          ))}
        </ul>
        <p className="ta mt-5 text-[13px] text-ink-2">{t.boardFoot}</p>
      </section>
    </div>
  )
}

function Stat({ label, value, tone = '', hl }) {
  return (
    <div className={`min-w-0 rounded-md px-2 py-1 ${hl ? 'bg-navy-soft' : ''}`}>
      <dt className="ta text-[12px] text-ink-2">{label}</dt>
      <dd className={`display text-xl font-bold tnum ${tone}`}>{value}</dd>
    </div>
  )
}
