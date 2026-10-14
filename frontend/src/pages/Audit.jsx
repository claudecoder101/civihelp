import { useRef, useState } from 'react'
import { api } from '../api'
import { ErrorBox, Icon, fmtTime } from '../ui'
import { PageHead } from './StaffLayout'
import { gsap, reduced, settle, useEnter, useGSAP } from '../staff/motion'
import ResetDemo from '../staff/ResetDemo'

export default function Audit() {
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const scope = useEnter()

  async function verify() {
    setBusy(true); setErr(null); setRes(null)
    try { setRes({ ...(await api('/api/audit/verify')), at: new Date().toISOString() }) } catch (e) { setErr(e) } finally { setBusy(false) }
  }

  return (
    <div ref={scope}>
      <PageHead eyebrow="Tamper-evident" title="Audit log" sub="Every status change, link, login and lockout is an append-only event. Each event stores a SHA-256 hash of its contents plus the previous event's hash." />

      <section data-enter className="rounded-2xl bg-[#0b1a36] p-6 text-white shadow-[0_24px_60px_-28px_rgba(11,26,54,.8)] sm:p-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <button className="btn min-h-12 bg-white px-6 text-[17px] text-[#0b1a36] hover:bg-[#ffe3c4]" onClick={verify} disabled={busy}>
            <Icon name="shield" className="size-5" />{busy ? 'Recomputing every hash…' : res ? 'Verify again' : 'Verify chain'}
          </button>
          <p className="max-w-[56ch] text-white/70">Recomputes the whole chain from the first event. If anyone edits a row directly in the database, verification fails at that event.</p>
        </div>

        <div className="mt-6" aria-live="polite">
          <ErrorBox error={err} onRetry={verify} />
          {busy && <p className="font-mono text-sm text-white/60">GENESIS → …</p>}
          {res && <ChainWalk key={res.at} res={res} />}
          {!res && !busy && !err && <p className="font-mono text-sm text-white/45">Chain not checked this session.</p>}
        </div>
      </section>

      <section data-enter aria-label="How the chain works" className="mt-6 grid gap-px overflow-hidden rounded-xl bg-line/70 ring-1 ring-line/60 md:grid-cols-3">
        {[
          ['Append-only', 'Database triggers block UPDATE and DELETE on the events table.', 'shield'],
          ['Hash-chained', 'hash = SHA-256(previous hash + event contents). Changing one event changes every hash after it.', 'link'],
          ['Attributed', 'Each event records the signed-in officer and role, so actions are traceable to a person.', 'users'],
        ].map(([k, v, icon]) => (
          <div key={k} className="bg-card p-5">
            <p className="flex items-center gap-2 font-bold"><Icon name={icon} className="size-5 text-navy" />{k}</p>
            <p className="mt-1 text-[15px] text-ink-2">{v}</p>
          </div>
        ))}
      </section>

      <ResetDemo />
    </div>
  )
}

/* Lights the chain up link by link, then shows the verdict. Event ids are sequential, so cell n = event #n. */
function ChainWalk({ res }) {
  const ref = useRef(null)
  const counter = useRef(null)
  const n = Math.max(1, res.checked)
  const broken = !res.ok

  useGSAP(() => {
    const cells = gsap.utils.toArray('[data-cell]')
    if (reduced()) return
    const per = Math.min(0.06, 1.8 / n)
    const tl = gsap.timeline()
    const o = { i: 0 }
    tl.set('[data-verdict]', { autoAlpha: 0, y: 10 })
    tl.from(cells, { opacity: 0.12, scale: 0.6, duration: 0.25, stagger: per, ease: 'power2.out' }, 0)
    tl.to(o, { i: n, duration: per * n, ease: 'none', onUpdate: () => { if (counter.current) counter.current.textContent = Math.round(o.i) } }, 0)
    if (broken) tl.fromTo('[data-broken]', { scale: 1 }, { scale: 1.8, duration: 0.18, yoyo: true, repeat: 3, ease: 'power1.inOut' })
    tl.to('[data-verdict]', { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power3.out' })
    return settle(tl, (tl.duration() + 1) * 1000)
  }, { scope: ref })

  return (
    <div ref={ref}>
      <div className="mb-2 flex items-center justify-between font-mono text-[12.5px] text-white/60">
        <span>GENESIS</span>
        <span>checked <span ref={counter}>{n}</span> / {broken ? '?' : n}</span>
      </div>
      <ol className="flex flex-wrap gap-[3px]" aria-label={`${n} events checked`}>
        {Array.from({ length: n }, (_, k) => {
          const bad = broken && k === n - 1
          return <li key={k} data-cell data-broken={bad || undefined} title={`Event #${bad ? res.broken_at : k + 1}`}
            className={`size-3 rounded-[3px] ${bad ? 'bg-[#ff5a4e] ring-2 ring-[#ff5a4e]/40' : 'bg-[#4fd18b]'}`} />
        })}
        {broken && Array.from({ length: 12 }, (_, k) => <li key={`u${k}`} aria-hidden className="size-3 rounded-[3px] bg-white/10" />)}
      </ol>

      <div data-verdict className={`mt-6 flex flex-wrap items-center gap-5 rounded-xl p-6 sm:p-7 ${broken ? 'bg-bad' : 'bg-ok'}`}>
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/15"><Icon name={broken ? 'alert' : 'check'} className="size-9" /></span>
        <div className="min-w-0">
          <p className="text-[clamp(1.7rem,4vw,2.6rem)] font-extrabold leading-tight tracking-tight">
            {broken ? <>Tampering detected at event <span className="font-mono">#{res.broken_at}</span></> : 'Chain intact'}
          </p>
          <p className="text-[17px] text-white/90">
            {broken
              ? `Its stored hash no longer matches its contents. Every event after it is unverified. ${res.checked} events checked · ${fmtTime(res.at)}`
              : `${res.checked} events verified from genesis · ${fmtTime(res.at)}`}
          </p>
        </div>
      </div>
    </div>
  )
}
