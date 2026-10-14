import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { reducedMotion } from '../anim'
import { Icon } from '../ui'

gsap.registerPlugin(ScrollTrigger)

const different = [
  ['languages', 'Tamil ↔ English duplicate linking', 'An AI model reads meaning, not words. A Tamil report and an English report about the same bin become one issue, with meaning, distance and time shown separately.'],
  ['check', 'Closure verified by citizens', 'A department can mark work resolved, but only the citizen who reported it can close it, or reopen it.'],
  ['shield', 'Tamper-evident audit log', 'Every status change is hash-chained to the one before. Edit a row in the database and the chain visibly breaks.'],
  ['route', 'Routing that explains itself', 'Each suggested department comes with reasons and a confidence tier. Low confidence goes to a person, never a guess.'],
]
const flow = ['Report', 'Route', 'Own', 'Fix', 'Citizen confirms']

export default function About() {
  const el = useRef(null)
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
        <h1 className="text-[clamp(2.1rem,5vw,3.6rem)] font-bold leading-[1.02]">Complaints get closed. Problems don’t get fixed.</h1>
        <p className="mt-4 text-lg text-ink-2">Civihelp is an accountability layer for city complaints: one owner per issue, a deadline everyone can see, and a closure that only counts when the citizen agrees.</p>
      </header>

      <section aria-labelledby="prob-h">
        <h2 id="prob-h" className="text-2xl font-bold">The gap, in real numbers</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <article data-reveal className="card lift p-6">
            <p className="display text-5xl font-bold text-navy tnum">90% <span className="text-ink-2">vs</span> <span className="text-bad">22%</span></p>
            <p className="mt-3">Andhra Pradesh PGRS: complaints officially “resolved” vs citizens actually satisfied.</p>
          </article>
          <article data-reveal className="card lift p-6">
            <p className="display text-5xl font-bold text-bad tnum">414 <span className="text-2xl text-ink-2">of 13,552</span></p>
            <p className="mt-3">BMC Mumbai: escalated complaints that were resolved.</p>
          </article>
        </div>
        <p className="mt-3 text-[13px] text-ink-2">Sources: The Wire (AP PGRS satisfaction survey); Praja Foundation report on Mumbai civic complaints.</p>
      </section>

      <section aria-labelledby="diff-h">
        <h2 id="diff-h" className="text-2xl font-bold">What we do differently</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {different.map(([icon, title, body]) => (
            <article key={title} data-reveal className="card lift p-6">
              <span className="grid size-10 place-items-center rounded-lg bg-navy-soft text-navy"><Icon name={icon} className="size-5" /></span>
              <h3 className="mt-4 text-xl font-bold">{title}</h3>
              <p className="mt-2 text-ink-2">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="flow-h">
        <h2 id="flow-h" className="text-2xl font-bold">How an issue moves</h2>
        <ol data-flow className="relative mt-6 grid gap-4 sm:grid-cols-5">
          <span data-flowline aria-hidden className="absolute left-[10%] right-[10%] top-6 hidden h-0.5 bg-navy/30 sm:block" />
          {flow.map((s, i) => (
            <li key={s} data-step className="relative flex items-center gap-3 sm:flex-col sm:text-center">
              <span className={`grid size-12 shrink-0 place-items-center rounded-full font-bold ring-4 ring-paper ${i === flow.length - 1 ? 'bg-ok text-white' : 'bg-navy text-white'}`}>{i + 1}</span>
              <span className="font-semibold">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <section data-reveal className="card flex flex-wrap items-center gap-4 p-6 sm:p-8">
        <div className="flex gap-2">
          <span className="rounded-md bg-[#00689d] px-2.5 py-1 text-sm font-bold text-white">SDG 16</span>
          <span className="rounded-md bg-[#f99d26] px-2.5 py-1 text-sm font-bold text-ink">SDG 11</span>
        </div>
        <p className="text-ink-2">Accountable institutions and responsive decisions (16.6, 16.7) · basic urban services (11).</p>
        <div className="flex w-full flex-wrap gap-3">
          <Link to="/" className="btn btn-primary">Report an issue</Link>
          <Link to="/board" className="btn btn-ghost">City Accountability Board</Link>
          <Link to="/staff/login" className="btn btn-ghost">Staff login</Link>
        </div>
      </section>
    </div>
  )
}
