import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { Badge, ErrorBox, Icon, Loading, StatusBadge, fmtTime, relDue, useApi, useMeta } from '../ui'
import { gsap, reduced, settle, useEnter, useGSAP } from '../staff/motion'
import { DispatchTrail, Guides } from '../dispatch'

const CLOSURE = ['Repaired', 'No action needed', 'Referred to other authority', 'Could not resolve']
const actionStyle = { Resolved: 'btn-ok', Closed: 'btn-ok', Rejected: 'btn-bad' }
const actionLabel = { Acknowledged: 'Acknowledge', 'In progress': 'Start work / post update', Resolved: 'Mark resolved', Rejected: 'Reject to another dept', Closed: 'Close', Assigned: 'Reassign', Reassigned: 'Reassign', Escalated: 'Escalate' }

export default function IssueDetail() {
  const { id } = useParams()
  const { data: i, error, loading, reload } = useApi(`/api/issues/${id}`)
  const [action, setAction] = useState(null)
  const scope = useEnter([!!i])
  const lastStatus = useRef(null)
  // Status-change moment: when a transition lands, the new status pops and the newest audit link slides in.
  useGSAP(() => {
    if (!i) return
    const prev = lastStatus.current
    lastStatus.current = `${i.status}|${i.events.length}`
    if (!prev || prev === lastStatus.current || reduced()) return
    return settle(gsap.timeline()
      .fromTo('[data-status]', { scale: 0.7, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' })
      .from('[data-event]:last-child', { x: -16, opacity: 0, backgroundColor: 'rgba(255,153,51,.25)', duration: 0.6, ease: 'power3.out' }, 0.1), 1500)
  }, { scope, dependencies: [i?.status, i?.events.length] })

  if (loading && !i) return <Loading />
  if (error) return <><Back /><ErrorBox error={error} onRetry={reload} /></>
  if (!i) return null
  const ack = relDue(i.ack_due), res = relDue(i.resolve_due)
  const closed = ['Resolved', 'Closed'].includes(i.status)

  const jump = hash => {
    const el = document.getElementById(`ev-${hash.slice(0, 12)}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('bg-warn-soft'); setTimeout(() => el.classList.remove('bg-warn-soft'), 1600)
  }

  return (
    <div ref={scope}>
      <Back />
      <header data-enter className="rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[clamp(1.7rem,3vw,2.2rem)] font-extrabold tracking-[-0.02em]">Issue <span className="font-mono font-semibold">{i.id}</span></h1>
          <span data-status className="inline-flex"><StatusBadge status={i.status} /></span>
          {i.escalated && <Badge tone="solidBad"><Icon name="alert" />Escalated</Badge>}
          {i.overdue && <Badge tone="bad">Overdue</Badge>}
          {i.verified === true && <Badge tone="solidOk"><Icon name="check" />Citizen-verified</Badge>}
          {i.verified === false && <Badge tone="bad">Citizen disputed</Badge>}
        </div>
        <p className="mt-1 capitalize text-ink-2">{i.category} · {i.ward?.name || i.ward}</p>
        <dl className="mt-6 grid gap-px overflow-hidden rounded-lg bg-line/60 ring-1 ring-line/60 sm:grid-cols-2 xl:grid-cols-5">
          <Stat k="Owner department" v={i.dept_name} />
          <Stat k="Acknowledge by" v={fmtTime(i.ack_due)} note={!closed && i.status === 'Assigned' ? ack.text : null} bad={ack.overdue && i.status === 'Assigned'} />
          <Stat k="Resolve by" v={fmtTime(i.resolve_due)} note={!closed ? res.text : null} bad={res.overdue && !closed} />
          <Stat k="Priority" v={i.priority} note={`${i.report_count} linked report${i.report_count === 1 ? '' : 's'}`} />
          <Stat k="Bounces" v={i.bounce_count} note="Times rejected to another dept" bad={i.bounce_count > 1} />
        </dl>
        {i.sla_reason && <p className="mt-4 rounded-lg bg-sunk/70 p-3 text-[15px]"><strong>Why this due time:</strong> {i.sla_reason}</p>}
        {(i.closure_reason || i.evidence) && (
          <p className="mt-3 rounded-lg bg-ok-soft p-3 text-[15px]"><strong>Closure:</strong> {i.closure_reason}{i.evidence ? ` — evidence: ${i.evidence}` : ''}</p>
        )}
      </header>

      <section data-enter className="mt-6 rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="route" className="size-5 text-navy" />Dispatch trail</h2>
        <p className="mb-4 text-[14.5px] text-ink-2">Every hand-off between departments: when it was sent, when it was received and by whom. Click a stamp to see its audit event.</p>
        <DispatchTrail d={i.dispatch} onJump={jump} />
        <details className="mt-4"><summary className="cursor-pointer text-[14px] font-semibold text-navy">How to send, receive and track</summary><div className="mt-3"><Guides /></div></details>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section data-enter className="rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-6">
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

          <section data-enter className="rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-6">
            <h2 className="text-lg font-bold">Linked reports <span className="font-normal text-ink-2">({i.reports.length})</span></h2>
            <p className="text-[15px] text-ink-2">Duplicates are linked, never closed. Every reporter follows this issue.</p>
            <ul className="mt-3 space-y-3">
              {i.reports.map(r => <LinkedReport key={r.id} r={r} onDone={reload} />)}
            </ul>
          </section>
        </div>

        <section data-enter className="rounded-xl bg-card p-5 shadow-[0_1px_0_rgba(14,34,71,.04),0_10px_28px_-18px_rgba(14,34,71,.25)] ring-1 ring-line/60 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="link" className="size-5 text-navy" />Audit trail</h2>
            <span className="ml-auto rounded bg-sunk px-2 py-0.5 font-mono text-[12px] text-ink-2">{i.events.length} links · SHA-256</span>
          </div>
          <p className="text-[14.5px] text-ink-2">Append-only. Each event's hash includes the previous one, so editing any row breaks the chain.</p>
          <ol className="mt-5">
            <li className="relative pb-3 pl-9" aria-hidden>
              <span className="absolute left-[11px] top-5 h-full w-[2px] bg-[repeating-linear-gradient(to_bottom,var(--color-navy)_0_4px,transparent_4px_8px)] opacity-40" />
              <span className="absolute left-0 top-0 grid size-6 place-items-center rounded-md bg-[#0b1a36] font-mono text-[9px] text-white">0</span>
              <span className="font-mono text-[12px] text-ink-2">GENESIS</span>
            </li>
            {i.events.map((e, n) => (
              <li key={e.id} id={`ev-${e.hash?.slice(0, 12)}`} data-event className="relative scroll-mt-24 rounded-lg pb-5 pl-9 transition-colors duration-700 last:pb-0">
                {n < i.events.length - 1 && <span className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-[2px] bg-[repeating-linear-gradient(to_bottom,var(--color-navy)_0_4px,transparent_4px_8px)] opacity-40" aria-hidden />}
                <span className={`absolute left-0 top-0.5 grid size-6 place-items-center rounded-md font-mono text-[10px] font-semibold ${e.to_status ? 'bg-navy text-white' : 'bg-navy-soft text-navy'}`} aria-hidden>{n + 1}</span>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{e.kind}</span>
                  {e.to_status && <span className="text-sm text-ink-2">{e.from_status ? `${e.from_status} → ` : ''}<strong className="text-ink">{e.to_status}</strong></span>}
                  <span className="ml-auto text-sm text-ink-2 tnum">{fmtTime(e.created_at)}</span>
                </div>
                <p className="text-sm text-ink-2">{e.actor}{e.role ? ` · ${e.role}` : ''}</p>
                {e.reason && <p className="mt-1 text-[15px]">{e.reason}</p>}
                {e.public_note && <p className="ta mt-1 text-[15px] text-ink-2">Public: {e.public_note}</p>}
                <p className="mt-2 inline-flex max-w-full flex-wrap items-center gap-x-1.5 rounded-md bg-sunk/70 px-2 py-1 font-mono text-[12px]" title={`hash ${e.hash}
prev ${e.prev_hash}`}>
                  <span className="text-ink-2">prev</span><span className="text-ink-2">{e.prev_hash ? e.prev_hash.slice(0, 8) : 'genesis'}</span>
                  <span className="text-navy" aria-hidden>→</span>
                  <span className="text-ink-2">hash</span><span className="font-semibold text-navy">{e.hash?.slice(0, 8)}</span>
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
    <div className="bg-card p-3.5">
      <dt className="text-[13px] text-ink-2">{k}</dt>
      <dd className={`text-[17px] font-bold tnum ${bad ? 'text-bad' : ''}`}>{v}</dd>
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
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-lg bg-sunk/70 p-4 ring-1 ring-line/60">
      <p className="flex items-center gap-2 font-semibold"><StatusBadge status={issue.status} /><span aria-hidden>→</span><span className="sr-only">to</span><StatusBadge status={to} /></p>
      {moving && (
        <div>
          <label htmlFor="t-dept" className="label">New owner department <span className="text-bad">*</span></label>
          <select id="t-dept" className="field" value={f.new_dept_id} onChange={set('new_dept_id')} required>
            <option value="">Choose…</option>
            {meta?.departments.filter(d => d.id !== issue.dept_id && d.id !== 'triage').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
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
    <li className="rounded-lg bg-sunk/70 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono font-semibold text-navy">{r.id}</span>
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
