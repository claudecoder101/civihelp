import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, getStaff, getToken, setSession } from '../api'
import { Badge, Icon, Wordmark } from '../ui'

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
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="bg-card lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="tricolour" aria-hidden />
        <div className="flex items-center gap-3 px-4 py-4 lg:block">
          <Wordmark sub="Staff workbench" />
          <button className="btn btn-ghost btn-sm ml-auto lg:hidden" onClick={logout}><Icon name="logout" />Sign out</button>
        </div>
        <nav aria-label="Workbench" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
          {visible.map(([p, label, icon]) => (
            <NavLink key={p} to={p} className={({ isActive }) =>
              `flex min-h-11 shrink-0 items-center gap-3 rounded-md px-3 text-[15px] font-semibold transition-colors ${isActive ? 'bg-navy text-white' : 'text-ink-2 hover:bg-sunk hover:text-ink'}`}>
              <Icon name={icon} className="size-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        {staff && (
          <div className="mt-auto hidden p-4 lg:block">
            <div className="rounded-md bg-sunk p-3">
              <p className="font-bold leading-tight">{staff.name}</p>
              <p className="mt-0.5 text-sm text-ink-2">{staff.designation}</p>
              <p className="text-sm text-ink-2">{staff.dept_name || 'All departments'}</p>
              <Badge tone="navy" className="mt-2">{staff.role}</Badge>
            </div>
            <button className="btn btn-ghost btn-sm mt-3 w-full" onClick={logout}><Icon name="logout" />Sign out</button>
          </div>
        )}
      </aside>
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {staff && <p className="mb-4 text-sm text-ink-2 lg:hidden">Signed in as <strong className="text-ink">{staff.name}</strong> · {staff.role}</p>}
        <Outlet context={staff} />
      </main>
    </div>
  )
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.6rem,2.6vw,2.1rem)] font-extrabold leading-tight tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-ink-2">{sub}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
