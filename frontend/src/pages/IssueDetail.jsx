import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, Icon, Loading, StatusBadge, fmtTime, relDue, useApi, useMeta } from '../ui'

const CLOSURE = ['Repaired', 'No action needed', 'Referred to other authority', 'Could not resolve']
const actionStyle = { Resolved: 'btn-ok', Closed: 'btn-ok', Rejected: 'btn-bad' }
const actionLabel = { Acknowledged: 'Acknowledge', 'In progress': 'Start work / post update', Resolved: 'Mark resolved', Rejected: 'Reject to another dept', Closed: 'Close', Assigned: 'Reassign', Reassigned: 'Reassign', Escalated: 'Escalate' }

export default function IssueDetail() {
  const { id } = useParams()
  const { data: i, error, loading, reload } = useApi(`/api/issues/${id}`)
  const [action, setAction] = useState(null)

  if (loading && !i) return <Loading />
  if (error) return <><Back /><ErrorBox error={error} onRetry={reload} /></>
  if (!i) return null
  const ack = relDue(i.ack_due), res = relDue(i.resolve_due)
  const closed = ['Resolved', 'Closed'].includes(i.status)

  return (
    <div className="rise">
      <Back />
      <header className="rounded-lg bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Issue {i.id}</h1>
          <StatusBadge status={i.status} />
          {i.escalated && <Badge tone="solidBad"><Icon name="alert" />Escalated</Badge>}
          {i.overdue && <Badge tone="bad">Overdue</Badge>}
          {i.verified === true && <Badge tone="solidOk"><Icon name="check" />Citizen-verified</Badge>}
          {i.verified === false && <Badge tone="bad">Citizen disputed</Badge>}
        </div>
        <p className="mt-1 capitalize text-ink-2">{i.category} · {i.ward?.name || i.ward}</p>
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat k="Owner department" v={i.dept_name} />
          <Stat k="Acknowledge by" v={fmtTime(i.ack_due)} note={!closed && i.status === 'Assigned' ? ack.text : null} bad={ack.overdue && i.status === 'Assigned'} />
          <Stat k="Resolve by" v={fmtTime(i.resolve_due)} note={!closed ? res.text : null} bad={res.overdue && !closed} />
          <Stat k="Priority" v={i.priority} note={`${i.report_count} linked report${i.report_count === 1 ? '' : 's'}`} />
          <Stat k="Bounces" v={i.bounce_count} note="Times rejected to another dept" bad={i.bounce_count > 1} />
        </dl>
        {i.sla_reason && <p className="mt-4 rounded-md bg-sunk p-3 text-[15px]"><strong>Why this due time:</strong> {i.sla_reason}{i.rule_version ? <span className="text-ink-2"> (rules {i.rule_version})</span> : null}</p>}
        {(i.closure_reason || i.evidence) && (
          <p className="mt-3 rounded-md bg-ok-soft p-3 text-[15px]"><strong>Closure:</strong> {i.closure_reason}{i.evidence ? ` — evidence: ${i.evidence}` : ''}</p>
        )}
      </header>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-lg bg-card p-5">
            <h2 className="text-lg font-bold">Actions</h2>
            {i.allowed_actions.length === 0
              ? <p className="mt-1 text-ink-2">No actions available to your role at this status.</p>
              : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {i.allowed_actions.map(a => (
                    <button key={a} className={`btn ${action === a ? 'btn-primary' : actionStyle[a] || 'btn-ghost'}`} aria-pressed={action === a}
                      onClick={() => setAction(action === a ? null : a)}>{actionLabel[a] || a}</button>
                  ))}
                </div>
              )}
            {action && <TransitionForm key={action} issue={i} to={action} onDone={() => { setAction(null); reload() }} onCancel={() => setAction(null)} />}
          </section>

          <section className="rounded-lg bg-card p-5">
            <h2 className="text-lg font-bold">Linked reports <span className="font-normal text-ink-2">({i.reports.length})</span></h2>
            <p className="text-[15px] text-ink-2">Duplicates are linked, never closed. Every reporter follows this issue.</p>
            <ul className="mt-3 space-y-3">
              {i.reports.map(r => <LinkedReport key={r.id} r={r} onDone={reload} />)}
            </ul>
          </section>
        </div>

        <section className="rounded-lg bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="link" className="size-5 text-navy" />Audit trail</h2>
          <p className="text-[15px] text-ink-2">Append-only. Each event's hash includes the previous one, so editing any row breaks the chain.</p>
          <ol className="mt-4">
            {i.events.map((e, n) => (
              <li key={e.id} className="relative pb-5 pl-7 last:pb-0">
                {n < i.events.length - 1 && <span className="absolute left-[9px] top-6 h-full w-0.5 bg-sunk" aria-hidden />}
                <span className="absolute left-0 top-1 grid size-5 place-items-center rounded-full bg-navy-soft text-navy" aria-hidden><Icon name="link" className="size-3" /></span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{e.kind}</span>
                  {e.to_status && <span className="text-sm text-ink-2">{e.from_status ? `${e.from_status} → ` : ''}<strong className="text-ink">{e.to_status}</strong></span>}
                  <span className="ml-auto text-sm text-ink-2 tnum">{fmtTime(e.created_at)}</span>
                </div>
                <p className="text-sm text-ink-2">{e.actor}{e.role ? ` · ${e.role}` : ''}</p>
                {e.reason && <p className="mt-1 text-[15px]">{e.reason}</p>}
                {e.public_note && <p className="ta mt-1 text-[15px] text-ink-2">Public: {e.public_note}</p>}
                <p className="mt-1 flex items-center gap-1.5 font-mono text-[12.5px] text-ink-2" title={`hash ${e.hash}\nprev ${e.prev_hash}`}>
                  <Icon name="link" className="size-3.5" />{e.hash?.slice(0, 10)}
                  <span className="opacity-70">← {e.prev_hash ? e.prev_hash.slice(0, 10) : 'genesis'}</span>
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  )
}

const Back = () => <Link to="/staff/issues" className="mb-4 inline-flex items-center gap-1.5 rounded font-semibold text-navy hover:underline"><Icon name="back" />All issues</Link>

function Stat({ k, v, note, bad }) {
  return (
    <div>
      <dt className="text-sm text-ink-2">{k}</dt>
      <dd className={`text-lg font-bold tnum ${bad ? 'text-bad' : ''}`}>{v}</dd>
      {note && <dd className={`text-sm ${bad ? 'font-semibold text-bad' : 'text-ink-2'}`}>{note}</dd>}
    </div>
  )
}

function TransitionForm({ issue, to, onDone, onCancel }) {
  const { meta } = useMeta()
  const [f, setF] = useState({ reason: '', public_note: '', closure_reason: '', evidence: '', new_dept_id: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const set = k => e => setF({ ...f, [k]: e.target.value })
  const resolving = to === 'Resolved'
  const moving = ['Rejected', 'Assigned', 'Reassigned'].includes(to)
  const update = to === 'In progress' && issue.status === 'In progress'
  const missing = (resolving && (!f.closure_reason || !f.evidence.trim())) || (moving && (!f.new_dept_id || !f.reason.trim())) || (update && !f.public_note.trim())

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    const v = s => s.trim() || null
    try {
      await api(`/api/issues/${issue.id}/transition`, {
        body: {
          to, reason: v(f.reason), public_note: v(f.public_note),
          closure_reason: f.closure_reason || null, evidence: v(f.evidence),
          new_dept_id: f.new_dept_id || null,
        },
      })
      onDone()
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-md bg-sunk p-4">
      <p className="font-semibold">{issue.status} → {to}</p>
      {moving && (
        <div>
          <label htmlFor="t-dept" className="label">New owner department <span className="text-bad">*</span></label>
          <select id="t-dept" className="field" value={f.new_dept_id} onChange={set('new_dept_id')} required>
            <option value="">Choose…</option>
            {meta?.departments.filter(d => d.id !== issue.dept_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <p className="mt-1 text-sm text-ink-2">The new department must accept it. Ownership is never left empty.</p>
        </div>
      )}
      {resolving && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="t-cr" className="label">Closure reason <span className="text-bad">*</span></label>
            <select id="t-cr" className="field" value={f.closure_reason} onChange={set('closure_reason')} required>
              <option value="">Choose…</option>
              {CLOSURE.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="t-ev" className="label">Evidence <span className="text-bad">*</span></label>
            <input id="t-ev" className="field" value={f.evidence} onChange={set('evidence')} placeholder="e.g. Bin emptied 10:40, photo ref #5521" required />
          </div>
        </div>
      )}
      <div>
        <label htmlFor="t-reason" className="label">Internal reason {moving && <span className="text-bad">*</span>}</label>
        <input id="t-reason" className="field" value={f.reason} onChange={set('reason')} />
      </div>
      <div>
        <label htmlFor="t-note" className="label">Public note for residents {update && <span className="text-bad">*</span>}</label>
        <textarea id="t-note" rows={2} className="field ta" value={f.public_note} onChange={set('public_note')} placeholder="Shown on the tracking page and sent to every linked reporter" />
      </div>
      <ErrorBox error={err} />
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary" disabled={busy || missing}>{busy ? 'Saving…' : `Confirm: ${actionLabel[to] || to}`}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function LinkedReport({ r, onDone }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  async function unlink(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try { await api(`/api/links/${r.link_id}/unlink`, { body: { reason: reason.trim() } }); onDone() } catch (e2) { setErr(e2); setBusy(false) }
  }
  return (
    <li className="rounded-md bg-sunk p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-navy tnum">{r.id}</span>
        <span className="text-sm text-ink-2">{fmtTime(r.created_at)}</span>
        {r.link_id != null && !open && <button className="btn btn-sm ml-auto bg-card text-ink hover:bg-bad-soft hover:text-bad" onClick={() => setOpen(true)}>Unlink</button>}
      </div>
      <p className="ta mt-1 text-[15px]">“{r.text}”</p>
      {(r.linked_by || r.link_reason) && <p className="mt-1 text-sm text-ink-2">Linked{r.linked_by ? ` by ${r.linked_by}` : ''}{r.link_reason ? `: ${r.link_reason}` : ''}</p>}
      {open && (
        <form onSubmit={unlink} className="mt-2 space-y-2">
          <label htmlFor={`ul-${r.id}`} className="label">Why unlink? The report goes back to triage.</label>
          <input id={`ul-${r.id}`} className="field" value={reason} onChange={e => setReason(e.target.value)} autoFocus />
          <ErrorBox error={err} />
          <div className="flex gap-2">
            <button className="btn btn-bad btn-sm" disabled={busy || !reason.trim()}>{busy ? 'Unlinking…' : 'Unlink report'}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </li>
  )
}
