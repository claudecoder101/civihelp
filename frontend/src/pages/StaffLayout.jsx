import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api, getStaff, getToken, setSession } from '../api'
import Shell from '../shell'

const links = [
  ['/staff/triage', 'Triage', 'inbox'],
  ['/staff/issues', 'Issues', 'list'],
  ['/staff/dashboard', 'Dashboard', 'chart'],
  ['/staff/hotspots', 'Hotspots', 'map'],
  ['/staff/evaluation', 'Evaluation', 'gauge'],
  ['/staff/audit', 'Audit', 'shield'],
]

export default function StaffLayout() {
  const loc = useLocation()
  const nav = useNavigate()
  const [staff, setStaff] = useState(getStaff)
  const token = getToken()

  useEffect(() => {
    if (!token) return
    api('/api/me').then(s => { setStaff(s); setSession(token, s) }, e => {
      if (e.status === 401) nav('/login/staff', { replace: true, state: { from: loc.pathname } })
    })
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return <Navigate to="/login/staff" replace state={{ from: loc.pathname }} />

  const logout = () => { setSession(null); nav('/start', { replace: true }) }
  const visible = links.filter(([p]) => p !== '/staff/triage' || staff?.role !== 'officer')
  const primary = staff?.role === 'officer' ? { to: '/staff/issues', label: 'My work', icon: 'inbox' } : { to: '/staff/triage', label: 'Triage queue', icon: 'inbox' }

  return (
    <Shell variant="dark" home="/staff" sub="Staff workbench" links={visible} primary={primary} mainId="staff-main" onLogout={logout}
      user={staff && { name: staff.name, line: staff.designation, place: staff.dept_name || 'All departments', badge: staff.role }}>
      <Outlet context={staff} />
    </Shell>
  )
}

export function PageHead({ eyebrow, title, sub, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-[11.5px] font-medium uppercase tracking-[0.16em] text-[#c25a00]">{eyebrow}</p>}
        <h1 className="text-[clamp(1.7rem,2.8vw,2.35rem)] font-extrabold leading-[1.1] tracking-[-0.025em] [text-wrap:balance]">{title}</h1>
        {sub && <p className="mt-2 max-w-[62ch] text-[15.5px] text-ink-2 [text-wrap:pretty]">{sub}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
