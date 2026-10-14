import { useState } from 'react'
import { api } from '../api'
import { ErrorBox, Icon, fmtTime } from '../ui'
import { PageHead } from './StaffLayout'

export default function Audit() {
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function verify() {
    setBusy(true); setErr(null); setRes(null)
    try { setRes({ ...(await api('/api/audit/verify')), at: new Date().toISOString() }) } catch (e) { setErr(e) } finally { setBusy(false) }
  }

  return (
    <div className="rise">
      <PageHead title="Audit log" sub="Every status change, link, login and lockout is an append-only event. Each event stores a SHA-256 hash of its contents plus the previous event's hash." />

      <section className="rounded-lg bg-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn btn-primary px-6 text-[17px]" onClick={verify} disabled={busy}>
            <Icon name="shield" className="size-5" />{busy ? 'Recomputing every hash…' : 'Verify chain'}
          </button>
          <p className="max-w-lg text-ink-2">Recomputes the whole chain from the first event. If anyone edits a row directly in the database, it fails at that event.</p>
        </div>

        <div className="mt-6" aria-live="assertive">
          <ErrorBox error={err} onRetry={verify} />
          {res && (res.ok ? (
            <div className="rise flex flex-wrap items-center gap-5 rounded-lg bg-ok p-6 text-white sm:p-8">
              <span className="grid size-16 place-items-center rounded-full bg-white/15"><Icon name="check" className="size-9" /></span>
              <div>
                <p className="text-[clamp(1.8rem,4vw,2.75rem)] font-extrabold leading-tight">Chain intact</p>
                <p className="text-lg text-white/90 tnum">{res.checked} events verified · {fmtTime(res.at)}</p>
              </div>
            </div>
          ) : (
            <div className="rise flex flex-wrap items-center gap-5 rounded-lg bg-bad p-6 text-white sm:p-8">
              <span className="grid size-16 place-items-center rounded-full bg-white/15"><Icon name="alert" className="size-9" /></span>
              <div>
                <p className="text-[clamp(1.8rem,4vw,2.75rem)] font-extrabold leading-tight">Tampering detected at event #{res.broken_at}</p>
                <p className="text-lg text-white/90 tnum">Its stored hash no longer matches its contents. {res.checked} events checked · {fmtTime(res.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-px overflow-hidden rounded-lg bg-sunk md:grid-cols-3">
        {[
          ['Append-only', 'Database triggers block UPDATE and DELETE on the events table.'],
          ['Hash-chained', 'hash = SHA-256(previous hash + event contents). Changing one event changes every hash after it.'],
          ['Attributed', 'Each event records the signed-in officer and role, so actions are traceable to a person.'],
        ].map(([k, v]) => (
          <div key={k} className="bg-card p-5">
            <p className="flex items-center gap-2 font-bold"><Icon name="link" className="text-navy" />{k}</p>
            <p className="mt-1 text-[15px] text-ink-2">{v}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
