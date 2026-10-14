import { useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { api, setCitizen, setSession } from '../api'
import { Icon, LangToggle, Wordmark, useLang } from '../ui'

/* Demo identities. Citizens are fully simulated (no Aadhaar data requested or stored);
   staff use the real directory + OTP backend, auto-typed for the demo. */
const CITIZENS = [
  { id: 'priya', name: 'Priya S.', area: 'RS Puram', mobile: '+919894021482', aadhaar: 'XXXX XXXX 4821', otp: '482193', lang: 'Tamil' },
  { id: 'arun', name: 'Arun K.', area: 'Gandhipuram', mobile: '+919943017356', aadhaar: 'XXXX XXXX 7356', otp: '735614', lang: 'English' },
]
const STAFF = [
  { name: 'R. Kavitha', mobile: '+919000000001', line: 'Triage Officer · Grievance Cell', badge: 'triage' },
  { name: 'P. Lakshmi Priya', mobile: '+919000000003', line: 'Sanitary Inspector · Solid Waste', badge: 'officer' },
]
const ACCESS = {
  citizen: ['Report issues in Tamil or English', 'Track every department hand-off', 'Confirm a fix or reopen it'],
  triage: ['Triage queue: route new reports', 'Link duplicates the AI found', 'Dashboard, hotspots, audit log'],
  officer: ['Your department’s work queue', 'Receive (acknowledge) and resolve work', 'Send work on to another department'],
}
const TX = {
  en: { cTitle: 'Citizen sign in', sTitle: 'Staff sign in', cLede: 'Verify with your Aadhaar-linked mobile. This demo simulates the check — no Aadhaar data is requested or stored.',
    sLede: 'Only numbers in the official staff directory can sign in. Every login and failed attempt is written to the audit log.', cMobile: 'Aadhaar-linked mobile', sMobile: 'Registered government mobile',
    code: '6-digit code', send: 'Send code', verify: 'Verify and sign in', skipWait: 'Skip wait →', change: 'Change number', demo: 'Demo profiles',
    demoLede: 'One click: we type the number, wait for the code, type it and sign you in.', signedIn: 'Signed in', access: 'Your access', cont: 'Continue' },
  ta: { cTitle: 'குடிமகன் உள்நுழைவு', sTitle: 'அலுவலர் உள்நுழைவு', cLede: 'ஆதாருடன் இணைக்கப்பட்ட கைபேசி எண் மூலம் சரிபார்க்கவும். இந்த முன்னோட்டம் சரிபார்ப்பை உருவகப்படுத்துகிறது — ஆதார் விவரங்கள் கேட்கப்படுவதில்லை, சேமிக்கப்படுவதில்லை.',
    sLede: 'அதிகாரப்பூர்வ அலுவலர் பட்டியலில் உள்ள எண்கள் மட்டுமே உள்நுழையலாம். ஒவ்வொரு உள்நுழைவும் தணிக்கைப் பதிவில் எழுதப்படும்.', cMobile: 'ஆதாருடன் இணைந்த கைபேசி எண்', sMobile: 'பதிவு செய்யப்பட்ட அரசுக் கைபேசி எண்',
    code: '6 இலக்கக் குறியீடு', send: 'குறியீட்டை அனுப்பு', verify: 'சரிபார்த்து உள்நுழை', skipWait: 'காத்திருப்பைத் தவிர் →', change: 'எண்ணை மாற்று', demo: 'முன்னோட்டச் சுயவிவரங்கள்',
    demoLede: 'ஒரே சொடுக்கில்: எண்ணை உள்ளிட்டு, குறியீட்டுக்காகக் காத்திருந்து, அதை உள்ளிட்டு உள்நுழைய வைக்கிறோம்.', signedIn: 'உள்நுழைந்துவிட்டீர்கள்', access: 'உங்கள் அணுகல்', cont: 'தொடர' },
}
const mask = m => '••••' + m.slice(-2)
const norm = m => m.replace(/[\s-]/g, '').replace(/^(?=\d{10}$)/, '+91')

export default function Login() {
  const { kind } = useParams()
  const { t, lang } = useLang()
  const x = TX[lang] || TX.en
  const nav = useNavigate()
  const from = useLocation().state?.from
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('mobile')   // mobile | code | access
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)      // simulated SMS line
  const [err, setErr] = useState(null)
  const [who, setWho] = useState(null)        // citizen record during citizen OTP
  const [access, setAccess] = useState(null)  // { name, line, role, count }
  const skip = useRef(false)
  const runId = useRef(0)

  if (kind !== 'citizen' && kind !== 'staff') return <Navigate to="/start" replace />
  const isCitizen = kind === 'citizen'

  // Resolves after ms, or as soon as Skip is pressed.
  const sleep = ms => new Promise(r => { const end = Date.now() + ms; const tick = () => (skip.current || Date.now() >= end) ? r() : setTimeout(tick, 40); tick() })
  const typeInto = async (set, s, per = 45) => { for (let i = 1; i <= s.length; i++) { if (skip.current) { set(s); return } set(s.slice(0, i)); await sleep(per) } }
  const reset = () => { runId.current++; skip.current = false; setStep('mobile'); setCode(''); setMobile(''); setErr(null); setNote(null); setWho(null); setBusy(false) }

  /* ---------- citizen (simulated) ---------- */
  async function citizenSend(m) {
    setErr(null)
    const n = norm(m)
    const staffList = await api('/api/demo/staff').catch(() => [])
    if (staffList.some(s => s.mobile === n)) { setErr('This number belongs to a staff account. Use Staff login.'); return null }
    const c = CITIZENS.find(c => c.mobile === n)
    if (!c) { setErr('This demo only knows the two demo citizens. Pick a profile on the right.'); return null }
    setWho(c); setStep('code'); setNote(`Simulated: OTP sent to Aadhaar-linked mobile ${mask(c.mobile)}`)
    return c
  }
  async function citizenVerify(c, entered) {
    setErr(null)
    try {
      // The server checks the (mock) code and issues the citizen session that reporting and confirming require.
      const r = await api('/api/citizen/login', { body: { mobile: c.mobile, code: entered } })
      setCitizen({ id: c.id, name: c.name, area: c.area, mobile: c.mobile, token: r.token })
      setAccess({ name: c.name, line: `${c.area} · Aadhaar ${c.aadhaar} (simulated)`, role: 'citizen', count: null })
      setStep('access')
    } catch (e) { setErr(e.message) }
  }

  /* ---------- staff (real OTP backend) ---------- */
  async function staffSend(m) {
    setErr(null); setBusy(true)
    try {
      await api('/api/auth/request-otp', { body: { mobile: norm(m) } })
    } catch (e) {
      if (e.status !== 429) { setErr(e.message); setBusy(false); return false }  // 429 = a valid code was already sent
    }
    setBusy(false); setStep('code'); setNote(`Simulated SMS: code sent to ${mask(norm(m))}`)
    return true
  }
  async function staffVerify(m, entered) {
    setErr(null); setBusy(true)
    try {
      const r = await api('/api/auth/verify-otp', { body: { mobile: norm(m), code: entered } })
      setSession(r.token, r.staff)
      const count = await (r.staff.role === 'officer' ? api('/api/issues').then(l => l.filter(i => i.dept_id === r.staff.dept_id && !['Closed', 'Resolved'].includes(i.status)).length) : api('/api/triage').then(l => l.length)).catch(() => null)
      setAccess({ name: r.staff.name, line: r.staff.designation, role: r.staff.role === 'officer' ? 'officer' : 'triage', count })
      setStep('access')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  /* ---------- one-click demo profile ---------- */
  async function demo(profile, type) {
    if (type !== kind) nav(`/login/${type}`, { replace: true, state: { from } })
    const id = ++runId.current
    skip.current = false
    setStep('mobile'); setCode(''); setErr(null); setNote(null); setBusy(true)
    await typeInto(setMobile, profile.mobile)
    if (id !== runId.current) return
    if (type === 'citizen') {
      const c = await citizenSend(profile.mobile); if (!c) return
      await sleep(3000); if (id !== runId.current) return
      await typeInto(setCode, c.otp, 90)
      await sleep(300); await citizenVerify(c, c.otp); setBusy(false)
    } else {
      if (!await staffSend(profile.mobile)) return
      await sleep(3000); if (id !== runId.current) return
      const inbox = await api('/api/demo/sms-inbox').catch(() => [])
      const msg = inbox.find(x => x.to === profile.mobile)?.message || ''
      const otp = (msg.match(/\b\d{6}\b/) || [''])[0]
      await typeInto(setCode, otp, 90)
      await sleep(300); await staffVerify(profile.mobile, otp)
    }
  }

  const submit = async e => {
    e.preventDefault()
    if (step === 'mobile') {
      if (isCitizen) await citizenSend(mobile)
      else await staffSend(mobile)
    } else if (isCitizen) await citizenVerify(who, code.trim())
    else await staffVerify(mobile, code.trim())
  }
  const go = () => nav(from || (isCitizen ? '/report' : '/staff'), { replace: true })

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="tricolour" aria-hidden />
      <header className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4">
        <Wordmark sub="Coimbatore · civic pilot" />
        <div className="ml-auto flex items-center gap-2">
          <Link to="/start" className="btn btn-sm btn-ghost"><Icon name="back" /><span className="ta max-sm:sr-only">{t.mainMenu}</span></Link>
          <LangToggle />
        </div>
      </header>

      <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 pb-12 pt-2 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card rise p-5 sm:p-7">
          <div role="tablist" aria-label="Login type" className="flex w-fit rounded-lg bg-sunk p-1">
            {[['citizen', t.citizen, 'users'], ['staff', t.staffSide, 'shield']].map(([k, label, icon]) => (
              <Link key={k} role="tab" aria-selected={kind === k} to={`/login/${k}`} replace state={{ from }} onClick={reset}
                className={`ta flex min-h-10 items-center gap-2 rounded-md px-4 text-[15px] font-bold transition-colors ${kind === k ? 'bg-card text-navy shadow-sm' : 'text-ink-2 hover:text-ink'}`}><Icon name={icon} />{label}</Link>
            ))}
          </div>

          {step === 'access' && access ? (
            <div className="rise mt-6" aria-live="polite">
              <p className="flex items-center gap-2 font-bold text-ok"><span className="grid size-7 place-items-center rounded-full bg-ok text-white"><Icon name="check" /></span>{x.signedIn}</p>
              <h1 className="mt-3 text-2xl font-extrabold">{access.name}</h1>
              <p className="text-ink-2">{access.line}</p>
              <div className="mt-5 rounded-xl bg-navy-soft/60 p-4 ring-1 ring-navy/15">
                <p className="eyebrow ta">{x.access}</p>
                <ul className="mt-2 space-y-1.5">{ACCESS[access.role].map(a => <li key={a} className="flex gap-2"><Icon name="check" className="mt-1 size-4 shrink-0 text-ok" />{a}</li>)}</ul>
                {access.count != null && <p className="mt-3 font-semibold text-navy">{access.count} item{access.count === 1 ? '' : 's'} waiting for you</p>}
              </div>
              <button className="btn btn-primary mt-6 w-full sm:w-auto" onClick={go} autoFocus>{x.cont}<Icon name="arrow" /></button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-6 max-w-md" aria-live="polite">
              <h1 className="text-[clamp(1.5rem,2.6vw,1.9rem)] font-extrabold leading-tight">{isCitizen ? x.cTitle : x.sTitle}</h1>
              <p className="mt-1.5 text-[15px] text-ink-2">{isCitizen ? x.cLede : x.sLede}</p>

              <label htmlFor="m" className="label mt-5">{isCitizen ? x.cMobile : x.sMobile}</label>
              <input id="m" className="field font-mono" inputMode="tel" autoComplete="tel" value={mobile} disabled={step === 'code'}
                onChange={e => setMobile(e.target.value)} placeholder="+91 98xxxxxxxx" />

              {step === 'code' && isCitizen && who && (
                <div className="rise mt-4 overflow-hidden rounded-xl bg-gradient-to-br from-[#fff7ee] to-[#eef3fb] ring-1 ring-line">
                  <div className="flex items-center justify-between bg-[#0b1a36] px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white">
                    <span>Aadhaar · simulated</span><span className="rounded bg-[#ff9933] px-1.5 text-[#0b1a36]">Demo</span>
                  </div>
                  <div className="flex items-center gap-4 p-4">
                    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-navy text-lg font-bold text-white" aria-hidden>{who.name[0]}</span>
                    <div><p className="font-bold">{who.name}</p><p className="font-mono text-[15px] tracking-widest text-ink">{who.aadhaar}</p><p className="text-[13px] text-ink-2">{who.area}, Coimbatore</p></div>
                  </div>
                </div>
              )}

              {step === 'code' && (<>
                {note && <p className="mt-4 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-[14px] text-warn"><Icon name="phone" className="mt-0.5 size-4 shrink-0" />
                  <span>{note}{isCitizen && who ? <> · code <strong className="font-mono">{who.otp}</strong></> : ''}</span></p>}
                <label htmlFor="c" className="label mt-4">{x.code}</label>
                <input id="c" className="field font-mono text-lg tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
              </>)}

              {err && <p role="alert" className="mt-4 flex items-start gap-2 rounded-lg bg-bad-soft px-3 py-2 text-[14px] font-medium text-bad"><Icon name="alert" className="mt-0.5 size-4 shrink-0" />{err}</p>}

              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn btn-primary" disabled={busy}>{step === 'mobile' ? x.send : x.verify}</button>
                {busy && <button type="button" className="btn btn-ghost" onClick={() => { skip.current = true }}>{x.skipWait}</button>}
                {step === 'code' && !busy && <button type="button" className="btn btn-ghost" onClick={reset}>{x.change}</button>}
              </div>
            </form>
          )}
        </section>

        <aside aria-labelledby="demo-h" className="rise space-y-4">
          <div>
            <h2 id="demo-h" className="ta text-lg font-bold">{x.demo}</h2>
            <p className="ta text-[14px] text-ink-2">{x.demoLede}</p>
          </div>
          {[['citizen', CITIZENS.map(c => ({ ...c, line: `${c.area} · writes ${c.lang}` }))], ['staff', STAFF]].map(([type, list]) => (
            <div key={type}>
              <p className="eyebrow mb-2">{type === 'citizen' ? 'Citizens' : 'Staff'}</p>
              <div className="grid gap-2">
                {list.map(p => (
                  <button key={p.mobile} type="button" onClick={() => demo(p, type)}
                    className={`lift card flex items-center gap-3 p-3.5 text-left ${type === kind ? 'ring-2 ring-navy/25' : 'opacity-80 hover:opacity-100'}`}>
                    <span className={`grid size-10 shrink-0 place-items-center rounded-lg font-bold text-white ${type === 'citizen' ? 'bg-[#e07a10]' : 'bg-navy'}`} aria-hidden>{p.name[0]}</span>
                    <span className="min-w-0 flex-1"><span className="block font-bold leading-tight">{p.name}</span><span className="block truncate text-[13px] text-ink-2">{p.line}</span></span>
                    <Icon name="arrow" className="size-4 text-ink-2" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="rounded-lg bg-card/60 px-3 py-2 text-[12.5px] text-ink-2 ring-1 ring-line">Simulated identity for the demo. Real deployment: Aadhaar e-KYC / DigiLocker for citizens and an SMS gateway for staff OTP.</p>
        </aside>
      </main>
    </div>
  )
}
