import { Link } from 'react-router-dom'
import { useTilt } from '../anim'
import { Icon, LangToggle, Wordmark, useLang } from '../ui'

function Door({ to, title, lede, points, cta, icon, accent }) {
  const tilt = useTilt(9)
  return (
    <Link to={to} {...tilt} className="tilt card group block rounded-2xl p-6 sm:p-7 focus-visible:outline-offset-4">
      <span className={`pop grid size-12 place-items-center rounded-xl text-white ${accent}`}><Icon name={icon} className="size-6" /></span>
      <h2 className="ta pop mt-4 text-2xl font-extrabold">{title}</h2>
      <p className="ta mt-1.5 text-ink-2">{lede}</p>
      <ul className="mt-4 space-y-2 text-[15px]">
        {points.map(p => <li key={p} className="ta flex gap-2"><Icon name="check" className="mt-1 size-4 shrink-0 text-ok" />{p}</li>)}
      </ul>
      <span className="pop-2 btn btn-primary mt-6 w-full"><span className="ta">{cta}</span><Icon name="arrow" /></span>
    </Link>
  )
}

export default function Menu() {
  const { t } = useLang()
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="tricolour" aria-hidden />
      <header className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-4">
        <Wordmark sub="Coimbatore · civic pilot" />
        <div className="ml-auto"><LangToggle /></div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-12 pt-6">
        <h1 className="ta text-center text-[clamp(1.7rem,3.2vw,2.4rem)] font-extrabold">{t.menuTitle}</h1>
        <p className="ta mx-auto mt-2 max-w-lg text-center text-ink-2">{t.menuLede}</p>
        <div className="rise mt-8 grid gap-6 md:grid-cols-2">
          <Door to="/login/citizen" title={t.citizen} lede={t.citizenLede} points={t.citizenPoints} cta={t.continueCitizen} icon="users" accent="bg-[#e07a10]" />
          <Door to="/login/staff" title={t.staffSide} lede={t.staffLede} points={t.staffPoints} cta={t.continueStaff} icon="shield" accent="bg-navy" />
        </div>
        <p className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[15px] font-semibold">
          <Link to="/board" className="ta text-navy hover:underline">{t.board}</Link>
        </p>
      </main>
    </div>
  )
}
