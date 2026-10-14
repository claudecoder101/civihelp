import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, setSession } from '../api'
import { Badge, Icon, Wordmark, fmtTime, useApi } from '../ui'

const statusTitle = {
  403: 'This number is not in the official staff directory, or it has been deactivated.',
  429: 'Please wait before requesting another code.',
  401: 'That code is wrong or has expired.',
  423: 'Too many failed attempts. This number is locked for now.',
}

export default function StaffLogin() {
  const nav = useNavigate()
  const from = useLocation().state?.from || '/staff'
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('mobile')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const codeRef = useRef(null)
  const staff = useApi('/api/demo/staff')

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function requestOtp(e) {
    e?.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await api('/api/auth/request-otp', { body: { mobile: mobile.trim() } })
      setStep('code'); setCode(''); setCooldown(r.cooldown_s ?? 30)
      setTimeout(() => codeRef.current?.focus(), 50)
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await api('/api/auth/verify-otp', { body: { mobile: mobile.trim(), code } })
      setSession(r.token, r.staff)
      nav(from, { replace: true })
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  return (
    <div className="min-h-dvh">
      <div className="tricolour" aria-hidden />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-14">
        <div>
          <Wordmark sub="Staff workbench" />
          <h1 className="mt-10 text-[clamp(1.9rem,3.6vw,2.6rem)] font-bold leading-[1.05]">Sign in with your registered government mobile</h1>
          <p className="mt-3 max-w-xl text-lg text-ink-2">Only numbers in the official staff directory can sign in. Every login, failed attempt and lockout is written to the audit log.</p>

          <div className="card mt-8 max-w-md p-6">
            {step === 'mobile' ? (
              <form onSubmit={requestOtp} noValidate>
                <label htmlFor="mobile" className="label">Mobile number</label>
                <input id="mobile" className="field text-lg tnum" type="tel" inputMode="tel" autoComplete="tel" value={mobile}
                  onChange={e => setMobile(e.target.value)} placeholder="+91 90000 00001" required />
                <button className="btn btn-primary mt-4 w-full" disabled={busy || !mobile.trim()}>{busy ? 'Sending code…' : 'Send one-time code'}</button>
              </form>
            ) : (
              <form onSubmit={verify} noValidate>
                <p className="text-[15px] text-ink-2">Code sent to <strong className="text-ink tnum">{mobile}</strong>. It expires in 5 minutes.</p>
                <label htmlFor="code" className="label mt-4">6-digit code</label>
                <input id="code" ref={codeRef} className="field mono text-center text-3xl tracking-[0.5em] tnum" inputMode="numeric"
                  autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
                <button className="btn btn-primary mt-4 w-full" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and sign in'}</button>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
                  <button type="button" className="rounded px-1 font-semibold text-navy underline-offset-2 hover:underline" onClick={() => { setStep('mobile'); setErr(null) }}>Change number</button>
                  <button type="button" className="rounded px-1 font-semibold text-navy underline-offset-2 hover:underline disabled:text-ink-2 disabled:no-underline"
                    disabled={cooldown > 0 || busy} onClick={requestOtp}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
                </div>
              </form>
            )}
            {err && (
              <div role="alert" className="mt-4 rounded-md bg-bad-soft p-3 text-bad">
                <p className="font-semibold">{statusTitle[err.status] || 'Sign-in failed.'}</p>
                {err.message && err.message !== statusTitle[err.status] && <p className="mt-0.5 text-sm">{err.message}</p>}
              </div>
            )}
          </div>

          <section className="mt-10 max-w-2xl">
            <h2 className="text-lg font-bold">Demo staff directory</h2>
            <p className="text-[15px] text-ink-2">Fictional officers for the demo. Select one to fill the number.</p>
            {staff.error && <p className="mt-2 text-bad">{staff.error.message}</p>}
            {staff.loading && <p className="mt-2 text-ink-2">Loading directory…</p>}
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {staff.data?.map(s => (
                <li key={s.mobile}>
                  <button type="button" onClick={() => { setMobile(s.mobile); setStep('mobile'); setErr(null) }}
                    className={`w-full rounded-md p-3 text-left transition-colors ${mobile === s.mobile ? "bg-navy-soft ring-2 ring-navy/30" : "card hover:bg-sunk"}`}>
                    <span className="flex items-center gap-2 font-semibold">{s.name}<Badge tone="navy" className="ml-auto">{s.role}</Badge></span>
                    <span className="block text-sm text-ink-2">{s.designation}{s.dept_name ? `, ${s.dept_name}` : ''}</span>
                    <span className="block text-sm font-medium tnum">{s.mobile}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <SmsInbox />
      </div>
    </div>
  )
}

function SmsInbox() {
  const [msgs, setMsgs] = useState([])
  const [err, setErr] = useState(null)
  useEffect(() => {
    let live = true
    const poll = () => api('/api/demo/sms-inbox').then(m => { if (live) { setMsgs(m); setErr(null) } }, e => live && setErr(e))
    poll()
    const id = setInterval(poll, 2000)
    return () => { live = false; clearInterval(id) }
  }, [])
  return (
    <aside className="self-start rounded-xl bg-ink p-5 shadow-lg text-white lg:sticky lg:top-6" aria-label="Simulated SMS inbox">
      <div className="flex items-center gap-2">
        <Icon name="phone" className="size-5" />
        <h2 className="text-lg font-bold">Demo SMS inbox</h2>
        <span className="ml-auto flex items-center gap-1.5 text-sm text-white/70"><span className="size-2 animate-pulse rounded-full bg-[#4ade80]" aria-hidden />live</span>
      </div>
      <p className="mt-1 rounded bg-warn-soft px-2 py-1 text-sm font-semibold text-warn">Simulated SMS — demo only. No real messages are sent.</p>
      {err && <p className="mt-3 text-sm text-[#fca5a5]">{err.message}</p>}
      <ul className="mt-4 max-h-[60vh] space-y-3 overflow-auto" aria-live="polite">
        {msgs.length === 0 && !err && <li className="text-white/70">No messages yet. Request a code to see it arrive here.</li>}
        {msgs.map((m, i) => (
          <li key={`${m.at}-${i}`} className={`rounded-md p-3 ${i === 0 ? 'bg-white text-ink' : 'bg-white/10'}`}>
            <p className={`text-[13px] tnum ${i === 0 ? 'text-ink-2' : 'text-white/70'}`}>To {m.to} · {fmtTime(m.at)}</p>
            <p className="mt-1">{m.message}</p>
          </li>
        ))}
      </ul>
    </aside>
  )
}
