import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, Icon, Loading, fmtTime, relDue, statusTone, useApi, useLang } from '../ui'

const Status = ({ s, t }) => <Badge tone={statusTone(s)}><span className="ta">{t.status[s] || s}</span></Badge>

const stepOf = { Triage: 0, Submitted: 0, Assigned: 1, Reopened: 1, Acknowledged: 2, 'In progress': 3, Resolved: 4, Closed: 5 }

export default function Track() {
  const { id } = useParams()
  const { t } = useLang()
  const nav = useNavigate()
  const [q, setQ] = useState(id || '')
  const { data, error, loading, reload } = useApi(id ? `/api/reports/${encodeURIComponent(id)}` : null)

  return (
    <div className="rise">
      <h1 className="ta text-[clamp(2rem,4.2vw,3.1rem)] font-bold leading-[1.05]">{t.trackTitle}</h1>
      <p className="ta mt-3 max-w-2xl text-lg text-ink-2">{t.trackLede}</p>
      <form className="mt-6 flex max-w-xl flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); const v = q.trim().toUpperCase(); if (v) nav(`/track/${v}`) }}>
        <div className="min-w-0 flex-1">
          <label htmlFor="tid" className="label ta">{t.trackingId}</label>
          <input id="tid" className="field mono text-lg uppercase tnum" value={q} onChange={e => setQ(e.target.value)} placeholder="CV-0042-K7Q2XM" autoComplete="off" />
        </div>
        <button className="btn btn-primary"><span className="ta">{t.trackBtn}</span></button>
      </form>

      <div className="mt-8">
        {loading && <Loading />}
        <ErrorBox error={error} onRetry={error?.status === 404 ? null : reload} />
        {data && <ReportView r={data} t={t} reload={reload} />}
      </div>
    </div>
  )
}

function Stepper({ status, t }) {
  const cur = stepOf[status] ?? 0
  return (
    <ol className="grid grid-cols-6 gap-1" aria-label="Progress">
      {t.steps.map((label, i) => {
        const state = i < cur ? 'done' : i === cur ? 'now' : 'todo'
        return (
          <li key={label} aria-current={state === 'now' ? 'step' : undefined} className="min-w-0">
            <div className={`h-2 rounded-full ${state === 'todo' ? 'bar' : status === 'Reopened' && state === 'now' ? 'bg-bad' : 'bg-navy'}`} />
            <p className={`ta mt-2 text-[12.5px] leading-tight sm:text-sm ${state === 'now' ? 'whitespace-nowrap font-bold text-ink sm:whitespace-normal' : state === 'done' ? 'text-ink max-sm:sr-only' : 'text-ink-2 max-sm:sr-only'}`}>
              {i === 1 && status === 'Reopened' ? (t.status.Reopened || 'Reopened') : label}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function ReportView({ r, t, reload }) {
  const issue = r.issue
  // once resolved/closed the deadline no longer runs — don't show it as overdue
  const due = issue && ['Resolved', 'Closed'].includes(issue.status) ? { text: t.stopped, overdue: false } : (d => d.text === '—' ? d : { ...d, text: d.overdue ? t.overdueBy(d.text.replace(/ overdue$/, '')) : t.dueIn(d.text.replace(/^in /, '')) })(relDue(issue?.resolve_due))
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="card p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mono break-all text-2xl font-medium text-navy tnum sm:text-3xl">{r.id}</span>
            <Status s={r.status} t={t} />
            {issue?.escalated && <Badge tone="solidBad"><Icon name="alert" /><span className="ta">{t.escalated}</span></Badge>}
          </div>
          <p className="ta mt-3 text-[17px]">“{r.text}”</p>
          <p className="mt-2 text-sm text-ink-2">{[r.ward?.name || r.ward, r.landmark, fmtTime(r.created_at)].filter(Boolean).join(' · ')}</p>
          <div className="mt-7"><Stepper status={r.status} t={t} /></div>
          {!issue && <p className="ta mt-5 rounded-md bg-warn-soft p-3 text-warn">{t.awaitingTriage}</p>}
        </section>

        {r.can_confirm && <Confirm id={r.id} t={t} onDone={reload} />}

        {issue && (
          <section className="card grid gap-px overflow-hidden bg-line/60 sm:grid-cols-3">
            <Fact label={t.dept} value={issue.dept_name} />
            <Fact label={t.reportsLabel} value={issue.report_count} big />
            <Fact label={t.due} value={<span className={due.overdue ? 'text-bad' : ''}>{fmtTime(issue.resolve_due)}</span>}
              note={<>{due.text}{issue.sla_reason ? <><br />{issue.sla_reason}</> : null}</>} />
            {issue.closure_reason && <Fact label={t.closure} value={issue.closure_reason} />}
            {issue.evidence && <Fact label={t.evidence} value={<span className="text-base font-medium">{issue.evidence}</span>} wide />}
          </section>
        )}
      </div>

      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="ta text-lg font-bold">{t.timeline}</h2>
          <ol className="mt-3 space-y-4">
            {r.timeline.map((e, i) => (
              <li key={i} className="relative pl-6">
                <span className={`absolute left-0 top-1.5 size-3 rounded-full ${i === r.timeline.length - 1 ? 'bg-navy' : 'bg-line'}`} aria-hidden />
                <div className="flex flex-wrap items-center gap-2"><Status s={e.status} t={t} /><span className="text-sm text-ink-2">{fmtTime(e.at)}</span></div>
                {e.public_note && <p className="ta mt-1 text-[15px]">{e.public_note}</p>}
              </li>
            ))}
          </ol>
        </section>
        {r.notifications?.length > 0 && (
          <section className="card p-5">
            <h2 className="ta flex items-center gap-2 text-lg font-bold"><Icon name="inbox" className="size-5 text-navy" />{t.notifications}</h2>
            <ul className="mt-3 space-y-3">
              {r.notifications.map((n, i) => (
                <li key={i} className="rounded-md bg-sunk p-3">
                  <p className="ta text-[15px]">{n.message}</p>
                  <p className="mt-1 text-[13px] text-ink-2">{fmtTime(n.at)}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function Fact({ label, value, note, big, wide }) {
  return (
    <div className={`bg-card p-5 ${wide ? 'sm:col-span-2' : ''}`}>
      <p className="ta text-sm text-ink-2">{label}</p>
      <p className={`mt-1 font-bold ${big ? 'text-4xl tnum' : 'text-lg'}`}>{value}</p>
      {note && <p className="mt-1 text-sm text-ink-2">{note}</p>}
    </div>
  )
}

function Confirm({ id, t, onDone }) {
  const [mode, setMode] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  async function send(fixed) {
    setBusy(true); setErr(null)
    try {
      await api(`/api/reports/${encodeURIComponent(id)}/confirm`, { body: { fixed, note: note.trim() || null } })
      setMsg(fixed ? t.thanksFixed : t.thanksReopen)
      setTimeout(onDone, 1200)
    } catch (e) { setErr(e) } finally { setBusy(false) }
  }
  if (msg) return <p role="status" className="ta rounded-lg bg-ok-soft p-5 font-semibold text-ok">{msg}</p>
  return (
    <section className="rounded-xl bg-navy p-5 text-white shadow-lg sm:p-7">
      <h2 className="ta text-2xl font-bold">{t.wasFixed}</h2>
      <p className="ta mt-1 text-white/85">{t.fixedLede}</p>
      {mode === 'no' ? (
        <div className="mt-4">
          <label htmlFor="reopen-note" className="label ta text-white">{t.reopenNote}</label>
          <textarea id="reopen-note" rows={3} className="field ta" value={note} onChange={e => setNote(e.target.value)} />
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="btn btn-bad" disabled={busy || !note.trim()} onClick={() => send(false)}>{t.sendReopen}</button>
            <button className="btn bg-white/15 text-white hover:bg-white/25" onClick={() => setMode(null)}>{t.cancel}</button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="btn btn-ok" disabled={busy} onClick={() => send(true)}><Icon name="check" />{t.yes}</button>
          <button className="btn bg-white text-bad hover:bg-bad-soft" disabled={busy} onClick={() => setMode('no')}>{t.no}</button>
        </div>
      )}
      {err && <div className="mt-3"><ErrorBox error={err} /></div>}
    </section>
  )
}
