import { APP_NAME } from './brand'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { Icon, LangProvider, Loading, useLang, Wordmark } from './ui'
import Report from './pages/Report'
import Track from './pages/Track'

const StaffLogin = lazy(() => import('./pages/StaffLogin'))
const StaffLayout = lazy(() => import('./pages/StaffLayout'))
const Triage = lazy(() => import('./pages/Triage'))
const Issues = lazy(() => import('./pages/Issues'))
const IssueDetail = lazy(() => import('./pages/IssueDetail'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Hotspots = lazy(() => import('./pages/Hotspots'))
const Evaluation = lazy(() => import('./pages/Evaluation'))
const Audit = lazy(() => import('./pages/Audit'))

function PublicLayout() {
  const { lang, setLang, t } = useLang()
  const nav = ({ isActive }) => `rounded px-3 py-2 text-[15px] font-semibold ${isActive ? 'bg-navy-soft text-navy' : 'text-ink-2 hover:text-ink'}`
  return (
    <div className="min-h-dvh">
      <div className="tricolour" aria-hidden />
      <div className="bg-bad text-white">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-sm">
          <Icon name="phone" className="size-4" />
          <a href="tel:112" className="font-bold underline underline-offset-2">{t.emergency}</a>
          <span className="opacity-90">{t.emergencyNote}</span>
        </p>
      </div>
      <header className="bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Wordmark sub="Coimbatore · civic issues pilot" />
          <nav className="flex flex-wrap items-center gap-1 md:ml-auto" aria-label="Main">
            <NavLink to="/" end className={nav}>{t.report}</NavLink>
            <NavLink to="/track" className={nav}>{t.track}</NavLink>
            <NavLink to="/staff" className={nav}>{t.staff}</NavLink>
          </nav>
          <div role="group" aria-label="Language" className="flex rounded-md bg-sunk p-0.5 max-md:ml-auto">
            {[['en', 'EN'], ['ta', 'தமிழ்']].map(([k, label]) => (
              <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k}
                className={`min-h-9 rounded px-3 text-sm font-semibold ${lang === k ? 'bg-card text-navy shadow-sm' : 'text-ink-2'}`}>{label}</button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8"><Outlet /></main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-sm text-ink-2">
        {APP_NAME} demo pilot. Fictional wards and staff. Map data © OpenStreetMap contributors.
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="mx-auto max-w-6xl px-4"><Loading /></div>}>
        <Routes>
          <Route element={<LangProvider><PublicLayout /></LangProvider>}>
            <Route index element={<Report />} />
            <Route path="track" element={<Track />} />
            <Route path="track/:id" element={<Track />} />
          </Route>
          <Route path="staff/login" element={<StaffLogin />} />
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
    </BrowserRouter>
  )
}
