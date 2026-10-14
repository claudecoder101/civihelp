import { APP_NAME } from './brand'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { Link } from 'react-router-dom'
import { api, store } from './api'

// Vite rewrites asset URLs, so Leaflet's default icon path guess breaks.
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })

/* ---------- data loading ---------- */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: !!path })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!path) return
    let live = true
    setState(s => ({ ...s, loading: true, error: null }))
    api(path).then(
      data => live && setState({ data, error: null, loading: false }),
      error => live && setState({ data: null, error, loading: false }),
    )
    return () => { live = false }
  }, [path, n])
  const reload = useCallback(() => setN(x => x + 1), [])
  return { ...state, reload }
}

let metaPromise
export function useMeta() {
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    metaPromise ||= api('/api/meta').catch(e => { metaPromise = null; throw e })
    metaPromise.then(setMeta, setError)
  }, [])
  return { meta, error }
}

/* ---------- small pieces ---------- */
export function Loading({ label = 'Loading…' }) {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-ink-2">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-navy" aria-hidden />
      {label}
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-bad-soft px-4 py-3 text-bad">
      <Icon name="alert" className="size-5 shrink-0" />
      <span className="font-medium">{error.message || String(error)}</span>
      {onRetry && <button className="btn btn-sm btn-ghost ml-auto" onClick={onRetry}>Try again</button>}
    </div>
  )
}

const tones = {
  neutral: 'bg-sunk text-ink-2', navy: 'bg-navy-soft text-navy', ok: 'bg-ok-soft text-ok',
  warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', solidBad: 'bg-bad text-white', solidOk: 'bg-ok text-white',
}
export function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[13px] font-semibold ${tones[tone]} ${className}`}>{children}</span>
}

export const statusTone = s => ({ Triage: 'warn', Submitted: 'warn', Assigned: 'navy', Acknowledged: 'navy', 'In progress': 'navy', Resolved: 'ok', Closed: 'neutral', Reopened: 'bad', Rejected: 'bad', Escalated: 'bad' }[s] || 'neutral')
export const StatusBadge = ({ status }) => <Badge tone={statusTone(status)}>{status}</Badge>

const tierInfo = { high: ['ok', 'High confidence'], medium: ['warn', 'Medium · confirm'], low: ['bad', 'Low · needs review'] }
export function TierBadge({ tier }) {
  const [tone, label] = tierInfo[tier] || ['neutral', tier]
  return <Badge tone={tone}>{label}</Badge>
}

/* Stroke icons (Lucide-style geometry). Decorative unless given a label. */
const paths = {
  alert: 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  check: 'M20 6 9 17l-5-5',
  link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  pin: 'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2m3.5-6.9L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  x: 'M18 6 6 18M6 6l12 12',
  camera: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  layers: 'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  chart: 'M3 3v18h18M7 16v-4m5 4V8m5 8v-6',
  map: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zm7-4v16m8-12v16',
  gauge: 'M12 14l4-4M3.3 19a10 10 0 1 1 17.4 0',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
  back: 'M19 12H5m7 7-7-7 7-7',
}
export function Icon({ name, className = 'size-4', label }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={paths[name]} />
    </svg>
  )
}

/* ---------- time & numbers ---------- */
export const fmtTime = iso => iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '—'
export function relDue(iso) {
  if (!iso) return { text: '—', overdue: false }
  const mins = Math.round((new Date(iso) - Date.now()) / 60000)
  const a = Math.abs(mins), d = Math.floor(a / 1440), h = Math.floor((a % 1440) / 60), m = a % 60
  const span = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
  return mins < 0 ? { text: `${span} overdue`, overdue: true } : { text: `in ${span}`, overdue: false, soon: mins < 240 }
}
export const ago = iso => {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000)
  return mins < 60 ? `${Math.max(mins, 0)} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`
}
export const pct = (x, digits = 0) => x == null ? '—' : `${(x * 100).toFixed(digits)}%`
export const num = (x, digits = 1) => x == null ? '—' : Number(x).toFixed(digits)

/* ---------- resident language toggle (UI labels only) ---------- */
export const dict = {
  en: {
    report: 'Report an issue', track: 'Track a report', staff: 'Staff login', emergency: 'Emergency? Call 112',
    emergencyNote: 'This service is for non-emergency civic issues only.',
    title: 'Report a civic issue', lede: 'Tell us what is wrong and where. You get a tracking ID and updates until a citizen confirms it is fixed.',
    describe: 'What is the problem?', describeHint: 'Write in English or Tamil.',
    category: 'Category', optional: 'optional', location: 'Location', locationHint: 'Tap the map to move the pin.',
    landmark: 'Nearby landmark', contact: 'Phone for updates', photo: 'Photo', addPhoto: 'Add a photo', removePhoto: 'Remove',
    submit: 'Submit report', submitting: 'Submitting…',
    dupTitle: 'Already reported nearby?', dupLede: 'Following an existing issue adds your voice and raises its priority. You get every update.',
    follow: 'Follow this issue', following: 'Following…', noDup: 'No similar open issue nearby. Yours will be a new report.', checking: 'Checking nearby reports…',
    dupWait: 'Start describing the problem and we will check for similar reports nearby.',
    routeTitle: 'Likely department', routeLede: 'Suggested from your description and location. Staff confirm it.',
    received: 'Report received', followed: 'You are now following this issue', yourId: 'Your tracking ID', save: 'Save this ID to check progress.', trackThis: 'Track this report', another: 'Report another issue',
    trackTitle: 'Track your report', trackingId: 'Tracking ID', trackBtn: 'Track',
    dept: 'Department', due: 'Resolve by', citizens: n => `${n} citizen${n === 1 ? '' : 's'} reported this`, escalated: 'Escalated to supervisor',
    timeline: 'Public timeline', notifications: 'Updates sent to you', wasFixed: 'Was it fixed?', fixedLede: 'The department marked this resolved. Only a citizen can confirm it.',
    yes: 'Yes, it is fixed', no: 'No, reopen it', reopenNote: 'What is still wrong?', sendReopen: 'Reopen issue', cancel: 'Cancel',
    closure: 'Closure reason', evidence: 'Evidence', awaitingTriage: 'Waiting for a staff member to review and assign it.',
    thanksFixed: 'Thank you. The issue is closed as citizen-verified.', thanksReopen: 'The issue is reopened and back with the department.',
    steps: ['Submitted', 'Assigned', 'Acknowledged', 'In progress', 'Resolved', 'Closed'],
  },
  ta: {
    report: 'புகார் அளிக்க', track: 'புகாரைக் கண்காணிக்க', staff: 'அலுவலர் உள்நுழைவு', emergency: 'அவசரமா? 112 ஐ அழைக்கவும்',
    emergencyNote: 'இந்தச் சேவை அவசரமில்லாத குடிமைப் பிரச்சினைகளுக்கு மட்டும்.',
    title: 'குடிமைப் பிரச்சினையைப் புகாரளிக்கவும்', lede: 'என்ன பிரச்சினை, எங்கே என்று சொல்லுங்கள். கண்காணிப்பு எண் கிடைக்கும்; சரிசெய்யப்படும் வரை தகவல் வரும்.',
    describe: 'என்ன பிரச்சினை?', describeHint: 'தமிழ் அல்லது ஆங்கிலத்தில் எழுதலாம்.',
    category: 'வகை', optional: 'விருப்பம்', location: 'இடம்', locationHint: 'பின்னை நகர்த்த வரைபடத்தைத் தட்டவும்.',
    landmark: 'அருகிலுள்ள அடையாளம்', contact: 'தகவலுக்கான தொலைபேசி', photo: 'புகைப்படம்', addPhoto: 'புகைப்படம் சேர்க்க', removePhoto: 'நீக்கு',
    submit: 'புகாரைச் சமர்ப்பிக்கவும்', submitting: 'சமர்ப்பிக்கிறது…',
    dupTitle: 'அருகில் ஏற்கனவே புகாரளிக்கப்பட்டதா?', dupLede: 'ஏற்கனவே உள்ள பிரச்சினையைப் பின்தொடர்ந்தால் அதன் முன்னுரிமை உயரும்; எல்லாத் தகவலும் உங்களுக்கு வரும்.',
    follow: 'இதைப் பின்தொடரவும்', following: 'பின்தொடர்கிறது…', noDup: 'அருகில் இதுபோன்ற பிரச்சினை இல்லை. இது புதிய புகாராகும்.', checking: 'அருகிலுள்ள புகார்களைச் சரிபார்க்கிறது…',
    dupWait: 'பிரச்சினையை விவரிக்கத் தொடங்குங்கள்; அருகிலுள்ள இதுபோன்ற புகார்களைச் சரிபார்ப்போம்.',
    routeTitle: 'பொறுப்பான துறை', routeLede: 'உங்கள் விவரம் மற்றும் இடத்தின் அடிப்படையில். அலுவலர்கள் உறுதி செய்வர்.',
    received: 'புகார் பெறப்பட்டது', followed: 'இப்போது இந்தப் பிரச்சினையைப் பின்தொடர்கிறீர்கள்', yourId: 'உங்கள் கண்காணிப்பு எண்', save: 'முன்னேற்றத்தைப் பார்க்க இந்த எண்ணைச் சேமிக்கவும்.', trackThis: 'இந்தப் புகாரைக் கண்காணிக்க', another: 'மற்றொரு புகார்',
    trackTitle: 'உங்கள் புகாரைக் கண்காணிக்கவும்', trackingId: 'கண்காணிப்பு எண்', trackBtn: 'கண்காணி',
    dept: 'துறை', due: 'தீர்வுக் காலக்கெடு', citizens: n => `${n} குடிமக்கள் இதைப் புகாரளித்தனர்`, escalated: 'மேலதிகாரிக்கு அனுப்பப்பட்டது',
    timeline: 'பொது காலவரிசை', notifications: 'உங்களுக்கான அறிவிப்புகள்', wasFixed: 'சரி செய்யப்பட்டதா?', fixedLede: 'துறை இதைத் தீர்த்ததாகக் குறித்துள்ளது. குடிமக்கள் மட்டுமே உறுதி செய்ய முடியும்.',
    yes: 'ஆம், சரி செய்யப்பட்டது', no: 'இல்லை, மீண்டும் திற', reopenNote: 'இன்னும் என்ன பிரச்சினை?', sendReopen: 'மீண்டும் திற', cancel: 'ரத்து',
    closure: 'மூடல் காரணம்', evidence: 'ஆதாரம்', awaitingTriage: 'அலுவலர் பரிசீலித்து ஒதுக்குவதற்காகக் காத்திருக்கிறது.',
    thanksFixed: 'நன்றி. குடிமகன் உறுதிசெய்ததாக மூடப்பட்டது.', thanksReopen: 'பிரச்சினை மீண்டும் திறக்கப்பட்டு துறைக்கு அனுப்பப்பட்டது.',
    steps: ['சமர்ப்பிக்கப்பட்டது', 'ஒதுக்கப்பட்டது', 'ஏற்கப்பட்டது', 'நடைபெறுகிறது', 'தீர்க்கப்பட்டது', 'மூடப்பட்டது'],
  },
}

const LangCtx = createContext(null)
export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => store.get('cr_lang') === 'ta' ? 'ta' : 'en')
  const setLang = l => { store.set('cr_lang', l); setLangState(l) }
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  return <LangCtx.Provider value={{ lang, setLang, t: dict[lang] }}>{children}</LangCtx.Provider>
}
export const useLang = () => useContext(LangCtx)

export function Wordmark({ sub }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded">
      <span className="grid size-9 place-items-center rounded-md bg-navy text-white"><Icon name="check" className="size-5" /></span>
      <span className="leading-tight">
        <span className="block text-[17px] font-extrabold tracking-tight text-ink">{APP_NAME}</span>
        <span className="block text-[12.5px] text-ink-2">{sub}</span>
      </span>
    </Link>
  )
}

