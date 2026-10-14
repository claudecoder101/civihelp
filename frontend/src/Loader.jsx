import { useEffect, useState } from 'react'
import { APP_NAME } from './brand'
import { Logo, useLang } from './ui'

/* Once-per-session intro: bubbles merge, check draws, tricolour bar fills. Skippable; instant with reduced motion. */
export default function Loader() {
  const { t } = useLang()
  const [state, setState] = useState(() => {
    try { if (sessionStorage.getItem('cr_booted')) return 'done' } catch { /* storage blocked */ }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'done' : 'on'
  })
  const finish = () => setState(s => s === 'on' ? 'out' : s)
  useEffect(() => {
    if (state === 'on') { const t = setTimeout(finish, 2000); return () => clearTimeout(t) }
    if (state === 'out') {
      try { sessionStorage.setItem('cr_booted', '1') } catch { /* storage blocked */ }
      const t = setTimeout(() => setState('done'), 380); return () => clearTimeout(t)
    }
  }, [state])
  if (state === 'done') return null
  return (
    <div className={`loader ${state === 'out' ? 'out' : ''}`} role="status" aria-label={`Loading ${APP_NAME}`}>
      <div className="flex flex-col items-center gap-3">
        <Logo className="size-20" />
        <p className="ld-name display text-2xl font-bold text-white">{APP_NAME}</p>
        <div className="ld-bar h-1 w-[180px] overflow-hidden rounded-full bg-white/15"><i /></div>
        <div className="ld-st ta relative h-5 w-64 text-center text-[13px] text-white/70">{t.loading.map(s => <span key={s}>{s}</span>)}</div>
      </div>
      <button onClick={finish} className="absolute bottom-6 right-6 rounded-md px-3 py-2 text-sm font-semibold text-white/60 hover:bg-white/10 hover:text-white">{t.skip} →</button>
    </div>
  )
}
