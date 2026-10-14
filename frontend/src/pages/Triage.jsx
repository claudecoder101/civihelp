import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, Icon, Loading, TierBadge, ago, fmtTime, pct, useApi, useMeta } from '../ui'
import { PageHead } from './StaffLayout'
import { useEnter } from '../staff/motion'
import { Meter, ReasonChips } from '../staff/bits'

export default function Triage() {
  const { data, error, loading, reload } = useApi('/api/triage')
  const { meta } = useMeta()
  const [flash, setFlash] = useState(null)
  const done = msg => { setFlash(msg); reload() }
  const scope = useEnter([data?.length])

  return (
    <div ref={scope}>
      <PageHead eyebrow="Queue · oldest first" title="Triage" sub="New reports not yet linked to an issue. Confirm the department, or link the report to an existing issue so its reporter follows it.">
        {data && <Badge tone={data.length ? 'warn' : 'ok'}>{data.length} waiting</Badge>}
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>
      {flash && <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-ok-soft px-4 py-3 font-semibold text-ok"><Icon name="check" className="size-5 shrink-0" />{flash}</p>}
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && (
        <div className="flex items-center gap-4 rounded-xl bg-card p-8 ring-1 ring-line/60">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ok-soft text-ok"><Icon name="check" className="size-6" /></span>
          <div><p className="text-lg font-bold">Triage is clear</p><p className="text-ink-2">New reports appear here as residents submit them.</p></div>
        </div>
      )}
      <div className="space-y-6">
        {data?.map(item => <TriageCard key={item.report.id} item={item} meta={meta} onDone={done} />)}
      </div>
    </div>
  )
}

const label = 'font-mono text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink-2'

function TriageCard({ item, meta, onDone }) {
  const { report: r, routing, duplicates } = item
  const [dept, setDept] = useState(routing[0]?.dept_id && routing[0].dept_id !== 'triage' ? routing[0].dept_id : '')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const needsReview = !routing.length || routing[0].tier === 'low'
  const stripe = needsReview ? 'bg-bad' : routing[0]?.tier === 'medium' ? 'bg-[#c27a00]' : 'bg-ok'

  async function act(key, path, body, msg) {
    setBusy(key); setErr(null)
    try { const issue = await api(path, { body }); onDone(msg(issue)) } catch (e) { setErr(e); setBusy(null) }
  }

  return (
    <article data-enter className="overflow-hidden rounded-xl bg-card shadow-[0_1px_0_rgba(14,34,71,.04),0_12px_32px_-18px_rgba(14,34,71,.28)] ring-1 ring-line/60" aria-labelledby={`r-${r.id}`}>
      <div className={`h-1 ${stripe}`} aria-hidden />
      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={`r-${r.id}`} className="font-mono text-[17px] font-semibold tracking-tight text-navy">{r.id}</h2>
            {r.category ? <Badge className="capitalize">{r.category}</Badge> : <Badge tone="warn">No category given</Badge>}
            {needsReview && <Badge tone="solidBad"><Icon name="alert" />Needs review</Badge>}
            <span className="ml-auto flex items-center gap-1 text-sm text-ink-2" title={fmtTime(r.created_at)}><Icon name="clock" className="size-3.5" />{ago(r.created_at)}</span>
          </div>
          <blockquote className="ta mt-4 border-l-[3px] border-navy/25 pl-4 text-[18px] leading-relaxed [text-wrap:pretty]">{r.text}</blockquote>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-2"><Icon name="pin" className="size-4 shrink-0" />{[r.ward?.name || r.ward, r.landmark].filter(Boolean).join(' · ') || 'No location details'}</p>
          {r.photo_url && <img src={r.photo_url} alt={`Photo attached to ${r.id}`} loading="lazy" className="mt-3 max-h-48 rounded-lg object-cover" />}

          <div className="mt-5 rounded-lg bg-sunk/70 p-4">
            <label htmlFor={`d-${r.id}`} className="label">Create a new issue for</label>
            <div className="flex flex-wrap gap-2">
              <select id={`d-${r.id}`} className="field min-w-0 flex-1 basis-48" value={dept} onChange={e => setDept(e.target.value)}>
                <option value="" disabled>Choose department…</option>
                {meta?.departments.filter(d => d.id !== 'triage').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn btn-primary" disabled={!dept || !!busy}
                onClick={() => act('create', `/api/triage/${r.id}/create-issue`, { dept_id: String(dept), note: null },
                  i => `${r.id} → new issue ${i?.id ?? ''} assigned to ${i?.dept_name ?? 'department'}`)}>
                {busy === 'create' ? 'Creating…' : 'Create issue'}
              </button>
            </div>
          </div>
          {err && <div className="mt-3"><ErrorBox error={err} /></div>}
        </div>

        <div className="min-w-0 space-y-6">
          <section aria-label="Routing suggestions">
            <h3 className={label}>Routing · why this department</h3>
            {routing.length === 0 && <p className="mt-2 text-ink-2">No department matched. Choose one manually.</p>}
            <ol className="mt-2.5 space-y-2">
              {routing.map((rt, i) => (
                <li key={rt.dept_id} className={`rounded-lg p-3.5 ${i === 0 ? 'bg-navy-soft/70 ring-1 ring-navy/15' : 'bg-sunk/60'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="font-mono text-xs text-ink-2">#{i + 1}</span>
                    <button className="rounded font-bold text-navy underline-offset-2 hover:underline" onClick={() => setDept(rt.dept_id)}
                      aria-label={`Choose ${rt.dept_name}`}>{rt.dept_name}</button>
                    <span className="ml-auto"><TierBadge tier={rt.tier} /></span>
                  </div>
                  <Meter value={rt.score} label="Score" className="mt-2.5" />
                  <ReasonChips reasons={rt.reasons} />
                </li>
              ))}
            </ol>
          </section>

          <section aria-label="Possible duplicates">
            <h3 className={label}>Duplicate candidates · linked, never closed</h3>
            {duplicates.length === 0 && <p className="mt-2 text-ink-2">No open issue nearby looks similar.</p>}
            <ul className="mt-2.5 space-y-2.5">
              {duplicates.map(d => (
                <li key={d.issue_id} className={`rounded-lg p-3.5 ring-1 ${d.strong ? 'bg-ok-soft/70 ring-ok/25' : d.probable ? 'bg-warn-soft/70 ring-[#c27a00]/25' : 'bg-sunk/60 ring-transparent'}`}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <Link to={`/staff/issues/${d.issue_id}`} className="font-mono font-semibold text-navy hover:underline">Issue {d.issue_id}</Link>
                    {d.probable && (d.strong
                      ? <Badge tone="solidOk" className="ml-auto"><Icon name="check" />Probable match</Badge>
                      : <Badge tone="warn" className="ml-auto"><Icon name="alert" />Possible match · check</Badge>)}
                  </div>
                  <p className="ta mt-1.5 line-clamp-2 text-[15px]">“{d.sample_text}”</p>
                  <dl className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {[['Meaning', pct(d.similarity)], ['Distance', `${Math.round(d.distance_m)} m`], ['Apart', `${Math.round(d.hours_apart)} h`], ['Reports', d.report_count]].map(([k, v]) => (
                      <div key={k} className="rounded-md bg-card/85 px-2.5 py-1.5">
                        <dt className="text-[11px] uppercase tracking-wider text-ink-2">{k}</dt>
                        <dd className="font-mono text-[15px] font-semibold">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <ReasonChips reasons={d.reasons} />
                  <button className="btn btn-sm mt-3 bg-card text-navy ring-1 ring-navy/20 hover:bg-navy hover:text-white" disabled={!!busy}
                    onClick={() => act(`link-${d.issue_id}`, `/api/triage/${r.id}/link`, { issue_id: d.issue_id, reason: `Duplicate: ${Math.round(d.similarity * 100)}% meaning, ${Math.round(d.distance_m)} m` },
                      () => `${r.id} linked to issue ${d.issue_id}. The reporter now follows it.`)}>
                    <Icon name="link" />{busy === `link-${d.issue_id}` ? 'Linking…' : 'Link to this issue'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </article>
  )
}
