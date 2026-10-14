import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, getStaff, getToken, setSession } from '../api'
import { Icon, Wordmark } from '../ui'

const links = [
  ['triage', 'Triage', 'inbox'],
  ['issues', 'Issues', 'list'],
  ['dashboard', 'Dashboard', 'chart'],
  ['hotspots', 'Hotspots', 'map'],
  ['evaluation', 'Evaluation', 'gauge'],
  ['audit', 'Audit', 'shield'],
]

export default function StaffLayout() {
  const loc = useLocation()
  const nav = useNavigate()
  const [staff, setStaff] = useState(getStaff)
  const token = getToken()

  useEffect(() => {
    if (!token) return
    api('/api/me').then(s => { setStaff(s); setSession(token, s) }, e => {
      if (e.status === 401) nav('/staff/login', { replace: true, state: { from: loc.pathname } })
    })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <Navigate to="/staff/login" replace state={{ from: loc.pathname }} />

  const logout = () => { setSession(null); nav('/staff/login', { replace: true }) }
  const visible = links.filter(([p]) => p !== 'triage' || staff?.role !== 'officer')

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href="#staff-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-20 focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <aside className="relative z-10 bg-[#0b1a36] text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="tricolour" aria-hidden />
        <div className="flex items-center gap-3 px-4 py-4 lg:block lg:px-5 lg:py-5 [&_a]:text-white [&_span]:!text-inherit">
          <div className="min-w-0 [&_.bg-navy]:bg-white/10"><Wordmark sub="Staff workbench" /></div>
          <div className="ml-auto lg:hidden"><button className="btn btn-sm bg-white/10 text-white hover:bg-white/20" onClick={logout}><Icon name="logout" />Sign out</button></div>
        </div>
        <p className="hidden px-5 pb-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/45 lg:block">Operations</p>
        <nav aria-label="Workbench" className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0">
          {visible.map(([p, label, icon]) => (
            <NavLink key={p} to={p} className={({ isActive }) =>
              `group relative flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors duration-200 ${isActive ? 'bg-white text-[#0b1a36] shadow-[0_6px_20px_-8px_rgba(0,0,0,.6)]' : 'text-white/70 hover:bg-white/[.07] hover:text-white'}`}>
              {({ isActive }) => (<>
                <Icon name={icon} className={`size-[18px] ${isActive ? 'text-[#c25a00]' : ''}`} />{label}
              </>)}
            </NavLink>
          ))}
        </nav>
        {staff && (
          <div className="mt-auto hidden p-4 lg:block">
            <div className="rounded-xl bg-white/[.06] p-3.5 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 font-bold" aria-hidden>{staff.name?.[0]}</span>
                <div className="min-w-0">
                  <p className="truncate font-bold leading-tight">{staff.name}</p>
                  <p className="truncate text-[13px] text-white/60">{staff.designation}</p>
                </div>
              </div>
              <p className="mt-2.5 flex items-center justify-between gap-2 text-[13px] text-white/60">
                <span className="truncate">{staff.dept_name || 'All departments'}</span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider text-white/85">{staff.role}</span>
              </p>
            </div>
            <button className="btn btn-sm mt-3 w-full bg-white/[.06] text-white/80 hover:bg-white/15 hover:text-white" onClick={logout}><Icon name="logout" />Sign out</button>
          </div>
        )}
      </aside>
      <main id="staff-main" className="min-w-0 bg-[radial-gradient(1200px_400px_at_80%_-120px,rgba(22,48,95,.07),transparent)] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1360px]">
          {staff && <p className="mb-4 text-sm text-ink-2 lg:hidden">Signed in as <strong className="text-ink">{staff.name}</strong> · {staff.role}</p>}
          <Outlet context={staff} />
        </div>
      </main>
    </div>
  )
}

export function PageHead({ eyebrow, title, sub, children }) {
  return (
    <div className="mb-7 flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-[#c25a00]">{eyebrow}</p>}
        <h1 className="text-[clamp(1.7rem,2.8vw,2.35rem)] font-extrabold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">{title}</h1>
        {sub && <p className="mt-2 max-w-[62ch] text-[15.5px] text-ink-2 [text-wrap:pretty]">{sub}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
