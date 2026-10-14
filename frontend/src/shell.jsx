import { NavLink, Link, useLocation } from 'react-router-dom'
import { Icon, Wordmark } from './ui'

/* One app shell for both areas: left sidebar (sections + primary action) and a top bar
   (page title, extras like the language switch, profile, sign out).
   variant 'light' = citizen (frosted glass), 'dark' = staff (navy) so the side you're on is obvious. */
export default function Shell({ variant = 'light', home, sub, links, primary, user, onLogout, extras, signOutLabel = 'Sign out', mainId = 'main', children }) {
  const { pathname } = useLocation()
  const dark = variant === 'dark'
  const current = links.find(([to]) => pathname === to || pathname.startsWith(to + '/'))
  const item = ({ isActive }) => `group relative flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 text-[15px] font-semibold transition-colors duration-200 ${
    dark ? (isActive ? 'bg-white text-[#0b1a36] shadow-[0_6px_20px_-8px_rgba(0,0,0,.6)]' : 'text-white/70 hover:bg-white/[.07] hover:text-white')
         : (isActive ? 'bg-navy text-white shadow-[0_6px_18px_-8px_rgba(22,48,95,.7)]' : 'text-ink-2 hover:bg-navy/[.06] hover:text-ink')}`

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <a href={`#${mainId}`} className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[2000] focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to content</a>
      <aside className={`relative z-[1100] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col ${dark ? 'bg-[#0b1a36] text-white' : 'border-r border-white/60 bg-white/55 backdrop-blur-xl backdrop-saturate-150'}`}>
        <div className="tricolour" aria-hidden />
        <div className="flex items-center gap-3 px-4 py-4 lg:px-5">
          <Wordmark to={home} sub={sub} light={dark} />
        </div>
        {primary && (
          <div className="hidden px-3 pb-3 lg:block">
            <Link to={primary.to} className={`btn w-full ${dark ? 'bg-[#ff9933] text-[#0b1a36] hover:bg-[#ffab57]' : 'btn-primary'}`}><Icon name={primary.icon} />{primary.label}</Link>
          </div>
        )}
        <nav aria-label="Sections" className="flex gap-1 overflow-x-auto px-3 pb-3 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0">
          {links.map(([to, label, icon]) => (
            <NavLink key={to} to={to} className={item}>
              {({ isActive }) => (<><Icon name={icon} className={`size-[18px] ${isActive ? (dark ? 'text-[#c25a00]' : 'text-[#ffb366]') : ''}`} /><span className="ta">{label}</span></>)}
            </NavLink>
          ))}
        </nav>
        {user && (
          <div className="mt-auto hidden p-4 lg:block">
            <div className={`rounded-xl p-3.5 ring-1 ${dark ? 'bg-white/[.06] ring-white/10' : 'bg-white/70 ring-line'}`}>
              <div className="flex items-center gap-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg font-bold ${dark ? 'bg-white/10' : 'bg-navy text-white'}`} aria-hidden>{user.name?.[0]}</span>
                <div className="min-w-0">
                  <p className="truncate font-bold leading-tight">{user.name}</p>
                  <p className={`truncate text-[13px] ${dark ? 'text-white/60' : 'text-ink-2'}`}>{user.line}</p>
                </div>
              </div>
              {user.badge && <p className={`mt-2.5 flex items-center justify-between gap-2 text-[13px] ${dark ? 'text-white/60' : 'text-ink-2'}`}>
                <span className="truncate">{user.place}</span>
                <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${dark ? 'bg-white/10 text-white/85' : 'bg-navy-soft text-navy'}`}>{user.badge}</span>
              </p>}
            </div>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-[1000] border-b border-white/60 bg-white/50 backdrop-blur-xl backdrop-saturate-150">
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
            <p className="ta min-w-0 truncate text-[15px] font-bold text-ink">{current?.[1]}</p>
            <div className="ml-auto flex items-center gap-2">
              {extras}
              {user && <span className="hidden items-center gap-2 rounded-full bg-white/70 py-1 pl-1 pr-3 text-[13px] font-semibold ring-1 ring-line sm:inline-flex">
                <span className="grid size-6 place-items-center rounded-full bg-navy text-[11px] text-white" aria-hidden>{user.name?.[0]}</span>{user.name}
              </span>}
              {onLogout && <button className="btn btn-sm btn-ghost" onClick={onLogout}><Icon name="logout" /><span className="ta max-sm:sr-only">{signOutLabel}</span></button>}
            </div>
          </div>
        </header>
        <main id={mainId} className="mx-auto w-full max-w-[1360px] flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">{children}</main>
      </div>
    </div>
  )
}
