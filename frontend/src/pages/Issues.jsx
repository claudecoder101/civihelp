import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, ErrorBox, Icon, Loading, StatusBadge, relDue, useApi, useMeta } from '../ui'
import { PageHead } from './StaffLayout'

const STATUSES = ['Assigned', 'Acknowledged', 'In progress', 'Resolved', 'Closed', 'Reopened']

export default function Issues() {
  const [sp, setSp] = useSearchParams()
  const { meta } = useMeta()
  const nav = useNavigate()
  const qs = new URLSearchParams()
  for (const k of ['status', 'dept_id', 'overdue']) if (sp.get(k)) qs.set(k, sp.get(k))
  const { data, error, loading, reload } = useApi(`/api/issues${qs.size ? `?${qs}` : ''}`)
  const set = (k, v) => { const n = new URLSearchParams(sp); v ? n.set(k, v) : n.delete(k); setSp(n, { replace: true }) }

  return (
    <>
      <PageHead title="Issues" sub="Every issue has one owner department and a due time. Overdue issues escalate to a supervisor automatically.">
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg bg-card p-4">
        <div>
          <label htmlFor="f-status" className="label">Status</label>
          <select id="f-status" className="field" value={sp.get('status') || ''} onChange={e => set('status', e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-dept" className="label">Department</label>
          <select id="f-dept" className="field" value={sp.get('dept_id') || ''} onChange={e => set('dept_id', e.target.value)}>
            <option value="">All departments</option>
            {meta?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" className="size-5 accent-[#b3261e]" checked={sp.get('overdue') === '1'} onChange={e => set('overdue', e.target.checked ? '1' : '')} />
          Overdue only
        </label>
        {data && <span className="ml-auto text-sm text-ink-2">{data.length} issue{data.length === 1 ? '' : 's'}</span>}
      </div>

      <ErrorBox error={error} onRetry={reload} />
      {loading && !data && <Loading />}
      {data && (data.length === 0
        ? <p className="rounded-lg bg-card p-8 text-lg text-ink-2">No issues match these filters.</p>
        : (
          <div className="overflow-x-auto rounded-lg bg-card">
            <table className="w-full min-w-[820px] text-left text-[15px]">
              <thead className="bg-sunk text-sm text-ink-2">
                <tr>
                  {['Issue', 'Category', 'Ward', 'Owner', 'Status', 'Reports', 'Priority', 'Due'].map(h => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map(i => {
                  const due = relDue(['Resolved', 'Closed'].includes(i.status) ? null : (i.status === 'Assigned' || i.status === 'Reopened' ? i.ack_due : i.resolve_due))
                  return (
                    <tr key={i.id} onClick={() => nav(`/staff/issues/${i.id}`)} className={`cursor-pointer border-t border-sunk hover:bg-paper ${i.overdue ? 'bg-bad-soft/40' : ''}`}>
                      <td className="whitespace-nowrap px-4 py-3"><Link to={`/staff/issues/${i.id}`} className="font-bold text-navy hover:underline" onClick={e => e.stopPropagation()}>{i.id}</Link></td>
                      <td className="px-4 py-3 capitalize">{i.category}</td>
                      <td className="px-4 py-3">{i.ward?.name || i.ward}</td>
                      <td className="px-4 py-3">{i.dept_name}{i.bounce_count > 0 && <span className="ml-1 text-sm text-warn" title="Times rejected to another department">↺{i.bounce_count}</span>}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><StatusBadge status={i.status} />{i.escalated && <Badge tone="solidBad">Escalated</Badge>}</div></td>
                      <td className="px-4 py-3 font-semibold tnum">{i.report_count}</td>
                      <td className="px-4 py-3 tnum">{i.priority}</td>
                      <td className="px-4 py-3 tnum">
                        {i.overdue ? <Badge tone="solidBad"><Icon name="clock" />{due.text === '—' ? 'Overdue' : due.text}</Badge>
                          : <span className={due.soon ? 'font-semibold text-warn' : 'text-ink-2'}>{due.text}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
    </>
  )
}
