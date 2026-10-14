import { Link } from 'react-router-dom'
import Loader from '../Loader'
import { useTilt } from '../anim'
import { Icon, Wordmark, useLang } from '../ui'

/* Hero card: a Tamil and an English report slide in, the AI link draws, then they merge into one issue. */
function AiMatchCard({ t }) {
  const tilt = useTilt(10)
  return (
    <div {...tilt} className="tilt card relative p-5 sm:p-6" aria-label="Example: a Tamil and an English report merged into one issue">
      <p className="pop eyebrow flex items-center gap-2"><Icon name="languages" className="size-4 text-navy" />{t.aiMatch}</p>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
        <figure className="ai-in-l pop rounded-xl bg-[#fff4e8] p-3.5 ring-1 ring-[#ff9933]/40">
          <figcaption className="text-[12px] font-bold text-[#a14d00]">தமிழ் · Priya S.</figcaption>
          <p className="ta mt-1 text-[14.5px] leading-snug text-ink">காந்திபுரம் பேருந்து நிலையம் அருகே குப்பைத் தொட்டி நிரம்பி வழிகிறது</p>
        </figure>
        <figure className="ai-in-r pop rounded-xl bg-navy-soft p-3.5 ring-1 ring-navy/20">
          <figcaption className="text-[12px] font-bold text-navy">English · Arun K.</figcaption>
          <p className="mt-1 text-[14.5px] leading-snug text-ink">Garbage bin overflowing near Gandhipuram bus stand</p>
        </figure>
      </div>
      <div className="relative mx-auto my-2 h-9 w-2/3">
        <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden><path className="ai-link" pathLength="1" d="M2 1 Q50 26 98 1" fill="none" stroke="var(--color-navy)" strokeWidth="1.5" strokeDasharray="1" vectorEffect="non-scaling-stroke" /></svg>
        <span className="ai-badge pop-2 absolute left-1/2 top-1 inline-flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#0b1a36] px-3 py-1.5 text-[13px] font-bold text-white shadow-lg ring-2 ring-white">
          <span className="font-mono text-[#ffb366]">அ↔A</span> 91% {t.sameIssue}
        </span>
      </div>
      <div className="ai-merged pop mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-ok-soft px-3.5 py-3 text-[14px] ring-1 ring-ok/25">
        <Icon name="check" className="size-5 text-ok" />
        <strong className="ta text-ok">{t.linkedOne}</strong>
        <span className="font-mono text-[13px] text-ink-2">IS-0051 · Solid Waste</span>
        <span className="ta ml-auto text-[13px] font-semibold text-ink-2">{t.tracking(2)}</span>
      </div>
    </div>
  )
}

export default function Landing() {
  const { t } = useLang()
  return (
    <div className="flex min-h-dvh flex-col">
      <Loader />
      <div className="tricolour" aria-hidden />
      <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4">
        <Wordmark sub="Coimbatore · civic pilot" />
        <nav className="ml-auto flex items-center gap-1 text-[15px] font-semibold" aria-label="Public">
          <Link to="/board" className="nav-link relative rounded-md px-3 py-2 text-ink-2 hover:text-ink"><span className="ta">{t.board}</span></Link>
          <Link to="/about" className="nav-link relative rounded-md px-3 py-2 text-ink-2 hover:text-ink max-sm:hidden"><span className="ta">{t.about}</span></Link>
        </nav>
      </header>
      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-12 pt-4 lg:grid-cols-[1.05fr_1fr]">
        <section className="rise">
          <p className="ta font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-[#c25a00]">{t.heroEyebrow}</p>
          <h1 className="ta mt-3 text-[clamp(2rem,4.4vw,3.3rem)] font-extrabold leading-[1.04] text-ink">{t.heroTitle}</h1>
          <p className="ta mt-4 max-w-xl text-[17px] text-ink-2">{t.heroLede}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/start" className="btn btn-primary min-h-12 px-6 text-[16px]"><span className="ta">{t.enter}</span><Icon name="arrow" /></Link>
            <Link to="/board" className="btn btn-ghost min-h-12 px-5"><span className="ta">{t.board}</span></Link>
          </div>
          <ul className="mt-7 flex flex-wrap gap-2 text-[13px] font-semibold text-ink-2">
            {t.trust.map(x => <li key={x} className="ta rounded-full bg-card/70 px-3 py-1 ring-1 ring-line">{x}</li>)}
            <li className="rounded-full bg-[#00689d] px-3 py-1 text-white">SDG 16</li>
            <li className="rounded-full bg-[#f99d26] px-3 py-1 text-ink">SDG 11</li>
          </ul>
        </section>
        <AiMatchCard t={t} />
      </main>
    </div>
  )
}
