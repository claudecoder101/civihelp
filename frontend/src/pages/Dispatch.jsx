import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { Guides } from '../dispatch'
import { Card } from '../staff/bits'
import { useEnter } from '../staff/motion'
import { ErrorBox, Icon, Loading, StatusBadge, fmtTime, relDue, useApi } from '../ui'
import { PageHead } from './StaffLayout'

function Row({ i }) {
  const due = i.next_due ? relDue(i.next_due) : null
  const h = i.last_hop
  return (
    <li>
      <Link to={`/staff/issues/${i.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2.5 ring-1 ring-line/60 transition-colors hover:bg-navy/[.04] hover:ring-navy/30">
        <span className="font-mono font-semibold text-navy">{i.id}</span>
        <StatusBadge status={i.status} />
        <span className="capitalize text-ink-2">{i.category} · {i.ward?.name || i.ward}</span>
        {h && <span className="text-[13px] text-ink-2">{h.from} → <strong className="text-ink">{h.to}</strong> · sent {fmtTime(h.sent_at)}</span>}
        <span className="ml-auto text-[13px] font-semibold">{i.next_step}{due && <span className={due.overdue ? ' text-bad' : ' text-ink-2'}> · {due.text}</span>}</span>
      </Link>
    </li>
  )
}

function List({ title, sub, icon, rows, empty }) {
  return (
    <Card title={<>{title} <span className="font-normal text-ink-2">({rows.length})</span></>} sub={sub} icon={icon}>
      {rows.length === 0 ? <p className="text-ink-2">{empty}</p> : <ul className="space-y-2">{rows.map(i => <Row key={i.id} i={i} />)}</ul>}
    </Card>
  )
}

export default function Dispatch() {
  const staff = useOutletContext()
  const flash = useLocation().state?.flash
  const { data: d, error, loading, reload } = useApi('/api/dispatch')
  const scope = useEnter([!!d])
  if (loading && !d) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!d) return null
  const officer = staff?.role === 'officer'
  return (
    <div ref={scope}>
      <PageHead eyebrow={`Viewpoint · ${d.viewpoint}`} title={officer ? 'Dispatch & my work' : 'Dispatch'}
        sub={officer ? 'Work sent to your department, what you have received, and what you sent on that is not received yet.' : 'Issues the triage desk dispatched that the receiving department has not received yet.'}>
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>
      {flash && <p role="status" className="mb-4 flex items-start gap-2 rounded-lg bg-ok-soft px-4 py-3 font-semibold text-ok"><Icon name="check" className="mt-0.5 size-5 shrink-0" />{flash}</p>}
      <div data-enter className="mb-6"><Guides /></div>
      <div className="grid gap-6 xl:grid-cols-2">
        {officer && <List title="Incoming — receive these" sub="Sent to your department. Acknowledge to stamp them Received." icon="inbox" rows={d.incoming} empty="Nothing waiting to be received." />}
        <List title="Sent — not received yet" sub={`Dispatched by ${d.viewpoint}; the next department has not acknowledged.`} icon="arrow" rows={d.sent_waiting} empty="Everything you sent has been received." />
        {officer && <List title="Received — start work" sub="Acknowledged by your department, work not started." icon="check" rows={d.received} empty="No received items waiting." />}
        {officer && <List title="In progress — resolve with evidence" icon="clock" rows={d.in_progress} empty="Nothing in progress." />}
        {officer && <List title="Awaiting citizens" sub="Resolved by you; closes when enough reporters confirm." icon="users" rows={d.awaiting_citizens} empty="None awaiting confirmation." />}
      </div>
    </div>
  )
}
