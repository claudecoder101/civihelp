import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorBox, Icon, Loading, num, pct, useApi } from '../ui'
import { PageHead } from './StaffLayout'
import { CountUp, gsap, reduced, settle, useEnter, useGSAP } from '../staff/motion'
import { Card } from '../staff/bits'

export const C = { navy: '#16305f', ok: '#12693b', bad: '#b3261e', warn: '#c27a00', grey: '#9aa7b4', grid: '#e3e7ea', ink2: '#45536a' }
const axis = { tick: { fill: C.ink2, fontSize: 13 }, tickLine: false, axisLine: false }
const tip = { contentStyle: { borderRadius: 8, border: 'none', boxShadow: '0 8px 24px rgba(15,31,54,.18)', fontSize: 14 } }
const fmtPct = v => `${Math.round(v * 100)}%`
const fmtH = v => `${v.toFixed(1)} h`

export default function Dashboard() {
  const { data: d, error, loading, reload } = useApi('/api/dashboard')
  const scope = useEnter([!!d])
  if (loading && !d) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!d) return null
  const c = d.counts
  const gap = d.closure_rate != null && d.verified_rate != null ? Math.round((d.closure_rate - d.verified_rate) * 100) : null

  return (
    <div ref={scope}>
      <PageHead eyebrow="Live · all departments" title="Dashboard" sub="Operations and accountability. Every number is computed from the same event log the audit chain protects.">
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>

      <section data-enter aria-label="Key figures" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line/70 ring-1 ring-line/60 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi k="Unassigned" v={c.unassigned} note="in triage" tone={c.unassigned ? 'warn' : null} />
        <Kpi k="Awaiting ack" v={c.awaiting_ack} note="assigned, not seen" />
        <Kpi k="Near SLA" v={c.near_sla} note="due in < 4 h" tone={c.near_sla ? 'warn' : null} />
        <Kpi k="Overdue" v={c.overdue} note={`of ${c.open} open`} tone={c.overdue ? 'bad' : null} />
        <Kpi k="Overdue rate" v={d.overdue_rate} fmt={fmtPct} tone={d.overdue_rate > 0.2 ? 'bad' : null} />
        <Kpi k="Resolve time" v={d.resolve_hours?.median} fmt={fmtH} note={`median · P90 ${num(d.resolve_hours?.p90)} h`} />
      </section>

      <Hero d={d} gap={gap} />

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Overdue by department" sub="Open issues past their due time">
          {d.overdue_by_dept.length === 0 ? <Empty>Nothing overdue.</Empty> : (
            <ResponsiveContainer width="100%" height={Math.max(180, d.overdue_by_dept.length * 44)}>
              <BarChart data={d.overdue_by_dept} layout="vertical" margin={{ left: 0, right: 24 }}>
                <CartesianGrid horizontal={false} stroke={C.grid} />
                <XAxis type="number" allowDecimals={false} {...axis} />
                <YAxis type="category" dataKey="dept" width={128} {...axis} />
                <Tooltip {...tip} cursor={{ fill: '#f0f2f1' }} />
                <Bar isAnimationActive={false} dataKey="count" name="Overdue" fill={C.bad} radius={[0, 4, 4, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card title="Submitted vs resolved" sub="Reports per day, last 10 days">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.trend} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="date" {...axis} tickFormatter={s => String(s).slice(5)} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line isAnimationActive={false} type="monotone" dataKey="submitted" name="Submitted" stroke={C.navy} strokeWidth={2.5} dot={false} />
              <Line isAnimationActive={false} type="monotone" dataKey="resolved" name="Resolved" stroke={C.ok} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="By category" sub="Open and closed issues">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.by_category} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="category" {...axis} tickFormatter={s => s[0].toUpperCase() + s.slice(1)} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip {...tip} cursor={{ fill: '#f0f2f1' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar isAnimationActive={false} dataKey="open" name="Open" stackId="a" fill={C.navy} barSize={36} />
              <Bar isAnimationActive={false} dataKey="closed" name="Closed" stackId="a" fill={C.grey} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Accountability" sub="Signals that ownership is working">
          <dl className="grid grid-cols-2 gap-3">
            <Mini k="Acknowledge time" v={d.ack_hours?.median} fmt={fmtH} note={`median · P90 ${num(d.ack_hours?.p90)} h`} />
            <Mini k="Department bounces" v={d.bounce_total} note="rejections to another dept" />
            <Mini k="Open issues" v={c.open} />
            <Mini k="Closed issues" v={c.closed} />
          </dl>
          {d.clusters?.length > 0 && (
            <>
              <h3 className="mt-5 font-mono text-[11.5px] uppercase tracking-[0.14em] text-ink-2">Largest duplicate clusters</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {d.clusters.slice(0, 6).map(cl => (
                  <li key={cl.issue_id}><Link to={`/staff/issues/${cl.issue_id}`} className="inline-flex min-h-9 items-center gap-2 rounded-md bg-sunk px-3 text-sm font-semibold transition-colors hover:bg-navy hover:text-white">
                    <span className="font-mono">{cl.issue_id}</span><span className="opacity-70">{cl.report_count} reports</span></Link></li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

function Hero({ d, gap }) {
  const ref = useRef(null)
  useGSAP(() => {
    if (reduced()) return
    return settle(gsap.from('[data-bar]', { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power3.out', stagger: 0.25, delay: 0.2 }), 2500)
  }, { scope: ref })
  return (
    <section ref={ref} data-enter aria-labelledby="cv-title"
      className="relative mt-6 overflow-hidden rounded-2xl bg-[#0b1a36] p-6 text-white shadow-[0_24px_60px_-28px_rgba(11,26,54,.8)] sm:p-9">
      <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-[radial-gradient(closest-side,rgba(255,153,51,.18),transparent)]" aria-hidden />
      <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] lg:items-center">
        <div>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.16em] text-[#ffb366]">Verified closure</p>
          <h2 id="cv-title" className="mt-2 text-[clamp(1.7rem,3vw,2.4rem)] font-extrabold leading-[1.08] tracking-[-0.025em] [text-wrap:balance]">Closed is not the same as fixed</h2>
          <p className="mt-3 max-w-md text-white/75 [text-wrap:pretty]">Departments mark issues closed. Only residents can confirm the work was done. We publish both numbers side by side.</p>
          {gap != null && (
            <p className="mt-6 flex items-baseline gap-3">
              <CountUp value={gap} className="font-mono text-5xl font-semibold tracking-tight text-[#ffb366]" />
              <span className="text-white/80">point gap<br />between the two</span>
            </p>
          )}
          <p className="mt-4 text-[13px] text-white/50">Reference: AP PGRS reported 90% resolved vs 22% citizen satisfaction.</p>
        </div>
        <div className="space-y-7">
          <RateBar label="Closure rate" sub="marked resolved or closed by departments" v={d.closure_rate} color="bg-white" />
          <RateBar label="Citizen-verified rate" sub="residents confirmed it was fixed" v={d.verified_rate} color="bg-[#4fd18b]" />
        </div>
      </div>
    </section>
  )
}

function Kpi({ k, v, note, tone, fmt }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-[#a85f00]' : 'text-ink'
  return (
    <div className="relative bg-card p-4 sm:p-5">
      {tone && <span className={`absolute left-0 top-4 h-8 w-[3px] rounded-r ${tone === 'bad' ? 'bg-bad' : 'bg-[#c27a00]'}`} aria-hidden />}
      <p className="text-[13px] font-medium text-ink-2">{k}</p>
      <p className={`mt-1.5 font-mono text-[2rem] font-semibold leading-none tracking-tight ${color}`}><CountUp value={v} format={fmt} /></p>
      {note && <p className="mt-1.5 text-[12.5px] text-ink-2">{note}</p>}
    </div>
  )
}

function RateBar({ label, sub, v, color }) {
  const w = Math.max(0, Math.min(1, v ?? 0)) * 100
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <CountUp value={v} format={fmtPct} className="font-mono text-[clamp(2.6rem,5.5vw,4rem)] font-semibold leading-none tracking-tight" />
        <span className="min-w-0"><span className="block font-bold">{label}</span><span className="block text-sm text-white/65">{sub}</span></span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${label} ${pct(v)}`}>
        <div data-bar className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

const Mini = ({ k, v, note, fmt }) => (
  <div className="rounded-lg bg-sunk/70 p-3.5">
    <dt className="text-[13px] text-ink-2">{k}</dt>
    <dd className="mt-0.5 font-mono text-2xl font-semibold"><CountUp value={v} format={fmt} /></dd>
    {note && <dd className="text-[12.5px] text-ink-2">{note}</dd>}
  </div>
)
const Empty = ({ children }) => <p className="py-10 text-center text-ink-2">{children}</p>
