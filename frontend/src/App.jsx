import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { getCitizen, setCitizen } from './api'
import Shell from './shell'
import { Icon, LangProvider, LangToggle, Loading, useLang } from './ui'
import Landing from './pages/Landing'
import Menu from './pages/Menu'

const Report = lazy(() => import('./pages/Report'))
const Track = lazy(() => import('./pages/Track'))
const Board = lazy(() => import('./pages/Board'))
const About = lazy(() => import('./pages/About'))
const Login = lazy(() => import('./pages/Login'))
const StaffLayout = lazy(() => import('./pages/StaffLayout'))
const Triage = lazy(() => import('./pages/Triage'))
const Issues = lazy(() => import('./pages/Issues'))
const IssueDetail = lazy(() => import('./pages/IssueDetail'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Hotspots = lazy(() => import('./pages/Hotspots'))
const Evaluation = lazy(() => import('./pages/Evaluation'))
const Audit = lazy(() => import('./pages/Audit'))

function CitizenLayout() {
  const { t } = useLang()
  const nav = useNavigate()
  const citizen = getCitizen()
  const links = [
    ['/report', t.report, 'pin'],
    ['/track', t.track, 'route'],
    ['/board', t.board, 'chart'],
    ['/about', t.about, 'layers'],
  ]
  const logout = () => { setCitizen(null); nav('/start', { replace: true }) }
  return (
    <Shell variant="light" home="/" sub="Coimbatore · civic pilot" links={links} signOutLabel={t.signOut}
      extras={<LangToggle />}
      user={citizen && { name: citizen.name, line: citizen.area, place: t.citizen, badge: 'citizen' }} onLogout={citizen ? logout : null}>
      <p className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-ink px-3 py-2 text-[13.5px] text-white">
        <span className="grid size-5 place-items-center rounded-full bg-bad"><Icon name="phone" className="size-3" /></span>
        <a href="tel:112" className="ta font-bold underline decoration-white/40 underline-offset-2 hover:decoration-white">{t.emergency}</a>
        <span className="ta text-white/70">{t.emergencyNote}</span>
      </p>
      <Suspense fallback={<Loading />}><Outlet /></Suspense>
    </Shell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <Suspense fallback={<div className="mx-auto max-w-6xl px-4"><Loading /></div>}>
          <Routes>
            <Route index element={<Landing />} />
            <Route path="start" element={<Menu />} />
            <Route path="login/:kind" element={<Login />} />
            <Route element={<CitizenLayout />}>
              <Route path="report" element={<Report />} />
              <Route path="track" element={<Track />} />
              <Route path="track/:id" element={<Track />} />
              <Route path="board" element={<Board />} />
              <Route path="about" element={<About />} />
            </Route>
            <Route path="staff/login" element={<Navigate to="/login/staff" replace />} />
            <Route path="staff" element={<StaffLayout />}>
              <Route index element={<Navigate to="triage" replace />} />
              <Route path="triage" element={<Triage />} />
              <Route path="issues" element={<Issues />} />
              <Route path="issues/:id" element={<IssueDetail />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="hotspots" element={<Hotspots />} />
              <Route path="evaluation" element={<Evaluation />} />
              <Route path="audit" element={<Audit />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </LangProvider>
    </BrowserRouter>
  )
}
