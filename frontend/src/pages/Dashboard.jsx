import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorBox, Icon, Loading, num, pct, useApi } from '../ui'
import { PageHead } from './StaffLayout'

export const C = { navy: '#16305f', ok: '#12693b', bad: '#b3261e', warn: '#c27a00', grey: '#9aa7b4', grid: '#e3e7ea', ink2: '#45536a' }
const axis = { tick: { fill: C.ink2, fontSize: 13 }, tickLine: false, axisLine: false }
const tip = { contentStyle: { borderRadius: 6, border: 'none', boxShadow: '0 4px 16px rgba(15,31,54,.15)', fontSize: 14 } }

export default function Dashboard() {
  const { data: d, error, loading, reload } = useApi('/api/dashboard')
  if (loading && !d) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!d) return null
  const c = d.counts
  const gap = d.closure_rate != null && d.verified_rate != null ? Math.round((d.closure_rate - d.verified_rate) * 100) : null

  return (
    <div className="rise">
      <PageHead title="Dashboard" sub="Operations and accountability across all departments.">
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>

      <section className="grid gap-px overflow-hidden rounded-lg bg-sunk sm:grid-cols-3 xl:grid-cols-6">
        <Kpi k="Unassigned" v={c.unassigned} note="in triage" tone={c.unassigned ? 'warn' : null} />
        <Kpi k="Awaiting acknowledgement" v={c.awaiting_ack} />
        <Kpi k="Near SLA" v={c.near_sla} note="due soon" tone={c.near_sla ? 'warn' : null} />
        <Kpi k="Overdue" v={c.overdue} note={`of ${c.open} open`} tone={c.overdue ? 'bad' : null} />
        <Kpi k="Overdue rate" v={pct(d.overdue_rate)} tone={d.overdue_rate > 0.2 ? 'bad' : null} />
        <Kpi k="Resolve time" v={`${num(d.resolve_hours?.median)} h`} note={`median · P90 ${num(d.resolve_hours?.p90)} h`} />
      </section>

      <section className="mt-6 grid gap-6 rounded-lg bg-navy p-6 text-white sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" aria-labelledby="cv-title">
        <div>
          <h2 id="cv-title" className="text-2xl font-extrabold leading-tight">Closed is not the same as fixed</h2>
          <p className="mt-2 max-w-md text-white/85">Departments mark issues closed. Only residents can confirm the work was done. We publish both numbers side by side.</p>
          {gap != null && <p className="mt-5 text-lg"><strong className="text-3xl font-extrabold tnum">{gap}</strong> point gap between the two</p>}
          <p className="mt-3 text-sm text-white/70">Reference: AP PGRS reported 90% resolved vs 22% citizen satisfaction.</p>
        </div>
        <div className="space-y-6 self-center">
          <RateBar label="Closure rate" sub="marked resolved or closed by departments" v={d.closure_rate} color="#ffffff" />
          <RateBar label="Citizen-verified rate" sub="residents confirmed it was fixed" v={d.verified_rate} color="#4fd18b" />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Overdue by department" sub="Open issues past their due time">
          {d.overdue_by_dept.length === 0 ? <Empty>Nothing overdue.</Empty> : (
            <ResponsiveContainer width="100%" height={Math.max(180, d.overdue_by_dept.length * 44)}>
              <BarChart data={d.overdue_by_dept} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" allowDecimals={false} {...axis} />
                <YAxis type="category" dataKey="dept" width={150} {...axis} />
                <Tooltip {...tip} cursor={{ fill: '#f0f2f1' }} />
                <Bar dataKey="count" name="Overdue" fill={C.bad} radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>

        <Panel title="Submitted vs resolved" sub="Reports per day">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.trend} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="date" {...axis} tickFormatter={s => String(s).slice(5)} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line type="monotone" dataKey="submitted" name="Submitted" stroke={C.navy} strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="resolved" name="Resolved" stroke={C.ok} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="By category" sub="Open and closed issues">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.by_category} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="category" {...axis} tickFormatter={s => s[0].toUpperCase() + s.slice(1)} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} cursor={{ fill: '#f0f2f1' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar dataKey="open" name="Open" stackId="a" fill={C.navy} barSize={36} />
              <Bar dataKey="closed" name="Closed" stackId="a" fill={C.grey} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Accountability" sub="Signals that ownership is working">
          <dl className="grid grid-cols-2 gap-4">
            <Mini k="Acknowledge time" v={`${num(d.ack_hours?.median)} h`} note={`median · P90 ${num(d.ack_hours?.p90)} h`} />
            <Mini k="Department bounces" v={d.bounce_total} note="rejections to another dept" />
            <Mini k="Open issues" v={c.open} />
            <Mini k="Closed issues" v={c.closed} />
          </dl>
          {d.clusters?.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">Largest duplicate clusters</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {d.clusters.slice(0, 6).map(cl => (
                  <li key={cl.issue_id}><Link to={`/staff/issues/${cl.issue_id}`} className="inline-flex items-center gap-1.5 rounded-md bg-sunk px-3 py-1.5 text-sm font-semibold hover:bg-navy-soft">
                    {cl.issue_id}<span className="text-ink-2">{cl.report_count} reports</span></Link></li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ k, v, note, tone }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div className="bg-card p-4">
      <p className="text-sm text-ink-2">{k}</p>
      <p className={`mt-1 text-3xl font-extrabold tracking-tight tnum ${color}`}>{v ?? '—'}</p>
      {note && <p className="text-[13px] text-ink-2">{note}</p>}
    </div>
  )
}

function RateBar({ label, sub, v, color }) {
  const w = Math.max(0, Math.min(1, v ?? 0)) * 100
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-none tracking-tight tnum">{pct(v)}</span>
        <span className="min-w-0"><span className="block font-bold">{label}</span><span className="block text-sm text-white/75">{sub}</span></span>
      </div>
      <div className="mt-2 h-3 rounded-full bg-white/15" role="img" aria-label={`${label} ${pct(v)}`}>
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${w}%`, background: color }} />
      </div>
    </div>
  )
}

export function Panel({ title, sub, children }) {
  return (
    <section className="rounded-lg bg-card p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {sub && <p className="mb-3 text-sm text-ink-2">{sub}</p>}
      {children}
    </section>
  )
}
const Mini = ({ k, v, note }) => (
  <div className="rounded-md bg-sunk p-3">
    <dt className="text-sm text-ink-2">{k}</dt>
    <dd className="text-2xl font-extrabold tnum">{v ?? '—'}</dd>
    {note && <dd className="text-[13px] text-ink-2">{note}</dd>}
  </div>
)
const Empty = ({ children }) => <p className="py-10 text-center text-ink-2">{children}</p>
