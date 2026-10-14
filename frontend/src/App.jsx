import { APP_NAME } from './brand'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { Icon, LangProvider, Loading, useLang, Wordmark } from './ui'
import Report from './pages/Report'
import Track from './pages/Track'

const Board = lazy(() => import('./pages/Board'))
const About = lazy(() => import('./pages/About'))
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
  const nav = ({ isActive }) => `relative whitespace-nowrap rounded-md px-3 py-2 text-[15px] font-semibold transition-colors ${isActive ? 'bg-navy-soft text-navy' : 'text-ink-2 hover:bg-sunk hover:text-ink'}`
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[2000] focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <div className="tricolour" aria-hidden />
      <div className="bg-ink text-white">
        <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-1.5 text-[13.5px]">
          <span className="grid size-5 place-items-center rounded-full bg-bad"><Icon name="phone" className="size-3" /></span>
          <a href="tel:112" className="ta font-bold underline decoration-white/40 underline-offset-2 hover:decoration-white">{t.emergency}</a>
          <span className="ta text-white/70">{t.emergencyNote}</span>
        </p>
      </div>
      <header className="sticky top-0 z-[1100] border-b border-line/70 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Wordmark sub="Coimbatore · civic issues pilot" />
          <div role="group" aria-label="Language" className="flex rounded-md bg-sunk p-0.5 max-md:ml-auto md:order-last">
            {[['en', 'EN'], ['ta', 'தமிழ்']].map(([k, label]) => (
              <button key={k} onClick={() => setLang(k)} aria-pressed={lang === k}
                className={`min-h-9 rounded px-3 text-sm font-semibold transition-colors ${lang === k ? 'bg-card text-navy shadow-sm' : 'text-ink-2 hover:text-ink'}`}>{label}</button>
            ))}
          </div>
          <nav className="-mx-1 flex max-w-full items-center gap-1 overflow-x-auto md:ml-auto" aria-label="Main">
            <NavLink to="/" end className={nav}><span className="ta">{t.report}</span></NavLink>
            <NavLink to="/track" className={nav}><span className="ta">{t.track}</span></NavLink>
            <NavLink to="/board" className={nav}><span className="ta">{t.board}</span></NavLink>
            <NavLink to="/about" className={nav}><span className="ta">{t.about}</span></NavLink>
            <NavLink to="/staff" className={nav}><span className="ta">{t.staff}</span></NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-8 sm:pt-10"><Suspense fallback={<Loading />}><Outlet /></Suspense></main>
      <footer className="border-t border-line bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm text-ink-2 md:grid-cols-[1fr_2fr]">
          <div>
            <p className="display text-base font-bold text-ink">{APP_NAME}</p>
            <p className="ta mt-1">{t.footer}</p>
            <p className="ta mt-1">{t.footerMap}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {t.pillars.map((p, i) => (
              <li key={i} className="ta flex gap-2"><Icon name={['languages', 'check', 'shield'][i]} className="mt-0.5 size-4 shrink-0 text-navy" />{p}</li>
            ))}
          </ul>
        </div>
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
            <Route path="board" element={<Board />} />
            <Route path="about" element={<About />} />
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
