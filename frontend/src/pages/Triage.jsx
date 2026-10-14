import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, Icon, Loading, TierBadge, ago, fmtTime, pct, useApi, useMeta } from '../ui'
import { PageHead } from './StaffLayout'

export default function Triage() {
  const { data, error, loading, reload } = useApi('/api/triage')
  const { meta } = useMeta()
  const [flash, setFlash] = useState(null)
  const done = msg => { setFlash(msg); reload() }

  return (
    <>
      <PageHead title="Triage" sub="New reports not yet linked to an issue, oldest first. Confirm the department or link to an existing issue.">
        {data && <Badge tone={data.length ? 'warn' : 'ok'}>{data.length} waiting</Badge>}
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>
      {flash && <p role="status" className="mb-4 flex items-center gap-2 rounded-md bg-ok-soft px-4 py-3 font-semibold text-ok"><Icon name="check" />{flash}</p>}
      {loading && !data && <Loading />}
      <ErrorBox error={error} onRetry={reload} />
      {data?.length === 0 && <p className="rounded-lg bg-card p-8 text-lg text-ink-2">Triage is clear. New reports appear here as residents submit them.</p>}
      <div className="space-y-5">
        {data?.map(item => <TriageCard key={item.report.id} item={item} meta={meta} onDone={done} />)}
      </div>
    </>
  )
}

function TriageCard({ item, meta, onDone }) {
  const { report: r, routing, duplicates } = item
  const [dept, setDept] = useState(routing[0]?.dept_id && routing[0].dept_id !== 'triage' ? routing[0].dept_id : '')
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState(null)
  const needsReview = !routing.length || routing[0].tier === 'low'

  async function act(key, path, body, msg) {
    setBusy(key); setErr(null)
    try { const issue = await api(path, { body }); onDone(msg(issue)) } catch (e) { setErr(e); setBusy(null) }
  }

  return (
    <article className="rise grid gap-5 rounded-lg bg-card p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" aria-labelledby={`r-${r.id}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id={`r-${r.id}`} className="text-lg font-extrabold text-navy tnum">{r.id}</h2>
          {r.category ? <Badge>{r.category}</Badge> : <Badge tone="warn">No category given</Badge>}
          {needsReview && <Badge tone="solidBad"><Icon name="alert" />Needs review</Badge>}
          <span className="ml-auto text-sm text-ink-2" title={fmtTime(r.created_at)}>{ago(r.created_at)}</span>
        </div>
        <p className="ta mt-3 text-[17px] leading-relaxed">“{r.text}”</p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2"><Icon name="pin" />{[r.ward?.name || r.ward, r.landmark].filter(Boolean).join(' · ') || 'No location details'}</p>
        {r.photo_url && <img src={r.photo_url} alt={`Photo attached to ${r.id}`} loading="lazy" className="mt-3 max-h-48 rounded-md object-cover" />}

        <div className="mt-5 rounded-md bg-sunk p-4">
          <label htmlFor={`d-${r.id}`} className="label">Create a new issue for</label>
          <div className="flex flex-wrap gap-2">
            <select id={`d-${r.id}`} className="field min-w-0 flex-1" value={dept} onChange={e => setDept(e.target.value)}>
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

      <div className="min-w-0 space-y-5">
        <section>
          <h3 className="font-bold">Routing suggestions</h3>
          {routing.length === 0 && <p className="text-ink-2">No department matched. Choose one manually.</p>}
          <ol className="mt-2 space-y-2">
            {routing.map((rt, i) => (
              <li key={rt.dept_id} className={`rounded-md p-3 ${i === 0 ? 'bg-navy-soft' : 'bg-sunk'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="rounded font-bold text-navy underline-offset-2 hover:underline" onClick={() => setDept(rt.dept_id)}
                    aria-label={`Choose ${rt.dept_name}`}>{rt.dept_name}</button>
                  <span className="text-sm tnum text-ink-2">score {pct(rt.score)}</span>
                  <span className="ml-auto"><TierBadge tier={rt.tier} /></span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm">{rt.reasons.map(x => <li key={x}>{x}</li>)}</ul>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h3 className="font-bold">Possible duplicates</h3>
          {duplicates.length === 0 && <p className="text-ink-2">No open issue nearby looks similar.</p>}
          <ul className="mt-2 space-y-2">
            {duplicates.map(d => (
              <li key={d.issue_id} className={`rounded-md p-3 ${d.strong ? 'bg-ok-soft' : d.probable ? 'bg-warn-soft' : 'bg-sunk'}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Link to={`/staff/issues/${d.issue_id}`} className="font-bold text-navy hover:underline">Issue {d.issue_id}</Link>
                  <span className="text-sm font-semibold tnum">{pct(d.similarity)} meaning</span>
                  <span className="text-sm tnum text-ink-2">{Math.round(d.distance_m)} m · {Math.round(d.hours_apart)} h apart · {d.report_count} reports</span>
                  {d.probable && (d.strong ? <Badge tone="solidOk" className="ml-auto">Probable match</Badge> : <Badge tone="warn" className="ml-auto">Possible match · check</Badge>)}
                </div>
                <p className="ta mt-1 line-clamp-2 text-[15px]">“{d.sample_text}”</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">{d.reasons.map(x => <li key={x}>{x}</li>)}</ul>
                <button className="btn btn-sm mt-2 bg-card text-navy hover:bg-navy-soft" disabled={!!busy}
                  onClick={() => act(`link-${d.issue_id}`, `/api/triage/${r.id}/link`, { issue_id: d.issue_id, reason: `Duplicate: ${Math.round(d.similarity * 100)}% meaning, ${Math.round(d.distance_m)} m` },
                    () => `${r.id} linked to issue ${d.issue_id}. The reporter now follows it.`)}>
                  <Icon name="link" />{busy === `link-${d.issue_id}` ? 'Linking…' : 'Link to this issue'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </article>
  )
}
