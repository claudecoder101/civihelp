import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { reducedMotion, useTilt } from '../anim'
import { Icon, useLang } from '../ui'

gsap.registerPlugin(ScrollTrigger)

const TX = {
  en: {
    h1: 'Complaints get closed. Problems don’t get fixed.',
    lead: 'Civihelp is an accountability layer for city complaints: one owner per issue, a deadline everyone can see, and a closure that only counts when the citizen agrees.',
    gap: 'The gap, in real numbers', vs: 'vs', of: 'of 13,552',
    ap: 'Andhra Pradesh PGRS: complaints officially “resolved” vs citizens actually satisfied.',
    bmc: 'BMC Mumbai: escalated complaints that were resolved.',
    src: 'Sources: The Wire (AP PGRS satisfaction survey); Praja Foundation report on Mumbai civic complaints.',
    diff: 'What we do differently',
    different: [
      ['languages', 'Tamil ↔ English duplicate linking', 'An AI model reads meaning, not words. A Tamil report and an English report about the same bin become one issue, with meaning, distance and time shown separately.'],
      ['check', 'Closure verified by citizens', 'A department can mark work resolved, but it closes only when 30% of the citizens who reported it confirm. Any one of them can reopen it.'],
      ['shield', 'Tamper-evident audit log', 'Every status change is hash-chained to the one before. Edit a row in the database and the chain visibly breaks.'],
      ['route', 'Routing that explains itself', 'Each suggested department comes with reasons and a confidence tier. Low confidence goes to a person, never a guess.'],
    ],
    moves: 'How an issue moves', flow: ['Report', 'Route', 'Own', 'Fix', 'Citizen confirms'],
    sdg: 'Accountable institutions and responsive decisions (16.6, 16.7) · basic urban services (11).',
    report: 'Report an issue', board: 'City Accountability Board',
  },
  ta: {
    h1: 'புகார்கள் மூடப்படுகின்றன. பிரச்சினைகள் தீர்வதில்லை.',
    lead: 'Civihelp என்பது நகர புகார்களுக்கான பொறுப்புக்கூறல் அமைப்பு: ஒவ்வொரு பிரச்சினைக்கும் ஒரு பொறுப்பாளர், அனைவரும் பார்க்கக்கூடிய காலக்கெடு, குடிமகன் ஒப்புக்கொண்டால் மட்டுமே மூடல்.',
    gap: 'இடைவெளி — உண்மையான எண்களில்', vs: 'எதிர்', of: '/ 13,552',
    ap: 'ஆந்திரப் பிரதேச PGRS: அதிகாரப்பூர்வமாக “தீர்க்கப்பட்ட” புகார்கள் எதிர் உண்மையில் திருப்தியடைந்த குடிமக்கள்.',
    bmc: 'BMC மும்பை: மேல்முறையீடு செய்யப்பட்டு தீர்க்கப்பட்ட புகார்கள்.',
    src: 'ஆதாரங்கள்: The Wire (AP PGRS திருப்தி ஆய்வு); மும்பை குடிமைப் புகார்கள் குறித்த Praja Foundation அறிக்கை.',
    diff: 'நாங்கள் வேறுபடுவது எப்படி',
    different: [
      ['languages', 'தமிழ் ↔ ஆங்கில நகல் இணைப்பு', 'AI மாதிரி சொற்களை அல்ல, பொருளைப் புரிந்துகொள்கிறது. ஒரே குப்பைத் தொட்டி பற்றிய தமிழ், ஆங்கிலப் புகார்கள் ஒரே பிரச்சினையாகின்றன — பொருள், தூரம், நேரம் தனித்தனியாகக் காட்டப்படும்.'],
      ['check', 'குடிமக்கள் உறுதிசெய்யும் மூடல்', 'துறை வேலையை முடிந்ததாகக் குறிக்கலாம்; ஆனால் புகார் அளித்தவர்களில் 30% உறுதிசெய்தால் மட்டுமே மூடப்படும். யார் ஒருவரும் மீண்டும் திறக்கலாம்.'],
      ['shield', 'மாற்ற முடியாத தணிக்கைப் பதிவு', 'ஒவ்வொரு நிலை மாற்றமும் முந்தையதுடன் hash சங்கிலியாக இணைக்கப்படுகிறது. தரவுத்தளத்தில் ஒரு வரியைத் திருத்தினால் சங்கிலி உடைவது தெரியும்.'],
      ['route', 'தன்னை விளக்கும் வழிநடத்தல்', 'பரிந்துரைக்கப்படும் ஒவ்வொரு துறைக்கும் காரணங்களும் நம்பக நிலையும் உண்டு. நம்பகம் குறைவாக இருந்தால் ஒரு அலுவலர் முடிவு செய்வார் — ஊகம் இல்லை.'],
    ],
    moves: 'ஒரு பிரச்சினை எப்படி நகர்கிறது', flow: ['புகார்', 'வழிநடத்தல்', 'பொறுப்பு', 'சரிசெய்தல்', 'குடிமகன் உறுதி'],
    sdg: 'பொறுப்புள்ள நிறுவனங்கள், பதிலளிக்கும் முடிவுகள் (16.6, 16.7) · அடிப்படை நகர சேவைகள் (11).',
    report: 'புகார் அளிக்க', board: 'நகர பொறுப்புக்கூறல் பலகை',
  },
}

function TiltCard({ icon, title, body }) {
  const tilt = useTilt(7)
  return (
    <article data-reveal className="card p-6">
      <div {...tilt} className="tilt">
        <span className="pop grid size-10 place-items-center rounded-lg bg-navy-soft text-navy"><Icon name={icon} className="size-5" /></span>
        <h3 className="pop ta mt-4 text-xl font-bold">{title}</h3>
        <p className="ta mt-2 text-ink-2">{body}</p>
      </div>
    </article>
  )
}

export default function About() {
  const el = useRef(null)
  const { lang } = useLang()
  const c = TX[lang] || TX.en
  useGSAP(() => {
    if (reducedMotion()) return
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 85%', once: true,
      onEnter: els => gsap.from(els, { y: 24, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power3.out' }),
    })
    gsap.from('[data-step]', { scale: 0.85, opacity: 0, stagger: 0.18, duration: 0.45, ease: 'back.out(1.8)', scrollTrigger: { trigger: '[data-flow]', start: 'top 80%', once: true } })
    gsap.from('[data-flowline]', { scaleX: 0, transformOrigin: 'left center', duration: 1.2, ease: 'power2.inOut', scrollTrigger: { trigger: '[data-flow]', start: 'top 80%', once: true } })
  }, { scope: el })

  return (
    <div ref={el} className="space-y-16">
      <header className="max-w-3xl">
        <h1 className="text-[clamp(1.9rem,4vw,2.9rem)] font-bold leading-[1.02] ta">{c.h1}</h1>
        <p className="ta mt-4 text-lg text-ink-2">{c.lead}</p>
      </header>

      <section aria-labelledby="prob-h">
        <h2 id="prob-h" className="text-2xl font-bold ta">{c.gap}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article data-reveal className="card lift p-6">
            <p className="display text-5xl font-bold text-navy tnum">90% <span className="text-ink-2">{c.vs}</span> <span className="text-bad">22%</span></p>
            <p className="ta mt-3">{c.ap}</p>
          </article>
          <article data-reveal className="card lift p-6">
            <p className="display text-5xl font-bold text-bad tnum">414 <span className="text-2xl text-ink-2">{c.of}</span></p>
            <p className="ta mt-3">{c.bmc}</p>
          </article>
        </div>
        <p className="mt-3 text-[13px] text-ink-2 ta">{c.src}</p>
      </section>

      <section aria-labelledby="diff-h">
        <h2 id="diff-h" className="text-2xl font-bold ta">{c.diff}</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {c.different.map(([icon, title, body]) => <TiltCard key={title} icon={icon} title={title} body={body} />)}
        </div>
      </section>

      <section aria-labelledby="flow-h">
        <h2 id="flow-h" className="text-2xl font-bold ta">{c.moves}</h2>
        <ol data-flow className="relative mt-6 grid gap-4 sm:grid-cols-5">
          <span data-flowline aria-hidden className="absolute left-[10%] right-[10%] top-6 hidden h-0.5 bg-navy/30 sm:block" />
          {c.flow.map((s, i) => (
            <li key={s} data-step className="relative flex items-center gap-3 sm:flex-col sm:text-center">
              <span className={`grid size-12 shrink-0 place-items-center rounded-full font-bold ring-4 ring-paper ${i === c.flow.length - 1 ? 'bg-ok text-white' : 'bg-navy text-white'}`}>{i + 1}</span>
              <span className="ta font-semibold">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section data-reveal className="card flex flex-wrap items-center gap-4 p-6 sm:p-8">
        <div className="flex gap-2">
          <span className="rounded-md bg-[#00689d] px-2.5 py-1 text-sm font-bold text-white">SDG 16</span>
          <span className="rounded-md bg-[#f99d26] px-2.5 py-1 text-sm font-bold text-ink">SDG 11</span>
        </div>
        <p className="ta text-ink-2">{c.sdg}</p>
        <div className="flex w-full flex-wrap gap-3">
          <Link to="/report" className="btn btn-primary ta">{c.report}</Link>
          <Link to="/board" className="btn btn-ghost ta">{c.board}</Link>
        </div>
      </section>
    </div>
  )
}
