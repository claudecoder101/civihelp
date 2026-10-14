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
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  key: 'M15.5 7.5 19 4m2-2-9.6 9.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm-6.5 6.5 3 3L22 7l-3-3',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  languages: 'M5 8h8M9 4v4m-3 8c2-2 4-5 4-8m-6 4c1 2 3 4 6 5m3 7 4-10 4 10m-6.5-3h5',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h6M18 9v6a4 4 0 0 1-4 4H8',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
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
    report: 'Report an issue', track: 'Track a report', board: 'City board', about: 'How it works', staff: 'Staff login', emergency: 'Emergency? Call 112',
    emergencyNote: 'This service is for non-emergency civic issues only.',
    title: 'Report a civic issue', lede: 'Tell us what is wrong and where. You get a tracking ID and updates until a citizen confirms it is fixed.',
    describe: 'What is the problem?', describeHint: 'Write in English or Tamil.', minChars: 'Describe the problem in at least 10 characters to continue.',
    category: 'Category', optional: 'optional', location: 'Location', locationHint: 'Tap the map or drag the pin to the exact spot.',
    jumpTo: 'Jump to area', choose: 'Choose…', ward: 'Ward',
    landmark: 'Nearby landmark', landmarkEg: 'e.g. Gandhipuram bus stand', contact: 'Phone for updates', photo: 'Photo', addPhoto: 'Add a photo', removePhoto: 'Remove',
    submit: 'Submit report', submitting: 'Submitting…',
    dupTitle: 'Already reported nearby?', dupLede: 'Following an existing issue adds your voice and raises its priority. You get every update.',
    follow: 'Follow this issue', following: 'Following…', noDup: 'No similar open issue nearby. Yours will be a new report.', checking: 'Checking nearby reports…',
    dupWait: 'Start describing the problem and we will check for similar reports nearby, in English and Tamil.',
    likelySame: 'Likely the same issue', possiblySame: 'Possibly the same', crossLang: 'Tamil ↔ English',
    yourReport: 'Your report', existing: 'Already reported', meaning: 'Meaning', distance: 'Distance', time: 'Time apart',
    mAway: m => `${m} m away`, hApart: h => `${h} h apart`, whyMatch: 'Why we think so',
    routeTitle: 'Likely department', routeLede: 'Suggested from your description and location. Staff confirm it.',
    tier: { high: 'High confidence', medium: 'Medium · staff confirm', low: 'Low · staff review' },
    received: 'Report received', followed: 'You are now following this issue', yourId: 'Your tracking ID',
    secret: 'This ID works like a key: anyone with it can see your report. Keep it private and save it to check progress.',
    copy: 'Copy ID', copied: 'Copied', trackThis: 'Track this report', another: 'Report another issue',
    trackTitle: 'Track your report', trackLede: 'Enter the tracking ID you got when you reported.', trackingId: 'Tracking ID', trackBtn: 'Track',
    dept: 'Department', due: 'Resolve by', citizens: n => `${n} citizen${n === 1 ? '' : 's'} reported this`, reportsLabel: 'Citizens reporting this',
    escalated: 'Escalated to supervisor', stopped: 'Deadline stopped: marked resolved', overdueBy: s => `${s} overdue`, dueIn: s => `in ${s}`,
    timeline: 'Public timeline', notifications: 'Updates sent to you', wasFixed: 'Was it fixed?', fixedLede: 'The department marked this resolved. Only a citizen can confirm it.',
    yes: 'Yes, it is fixed', no: 'No, reopen it', reopenNote: 'What is still wrong?', sendReopen: 'Reopen issue', cancel: 'Cancel',
    closure: 'Closure reason', evidence: 'Evidence', awaitingTriage: 'Waiting for a staff member to review and assign it.',
    thanksFixed: 'Thank you. The issue is closed as citizen-verified.', thanksReopen: 'The issue is reopened and back with the department.',
    steps: ['Submitted', 'Assigned', 'Acknowledged', 'In progress', 'Resolved', 'Closed'],
    status: {},
    boardTitle: 'City Accountability Board', boardLede: 'Public accountability — every department’s record, visible to every citizen.',
    updated: 'Updated', reports: 'Reports', issues: 'Issues', open: 'Open', overdue: 'Overdue', medianResolve: 'Median time to resolve',
    gapTitle: 'Closed by departments vs confirmed by citizens', closedRate: 'Marked closed', verifiedRate: 'Citizen-verified',
    gapNote: g => `${g} percentage points of “closed” work have not been confirmed by any citizen.`,
    leaderboard: 'Department record', sortBy: 'Sort by', sortOverdue: 'Most overdue', sortResolve: 'Slowest to resolve', sortVerified: 'Lowest verified',
    resolved: 'Resolved', verified: 'Verified', ack: 'Median acknowledge', bounces: 'Bounced', hours: h => h == null ? '—' : `${h < 10 ? h.toFixed(1) : Math.round(h)} h`,
    byCategory: 'Open issues by category', boardFoot: 'Numbers come straight from the issue log. Demo pilot with fictional data.',
    footer: 'Demo pilot for Coimbatore. Wards, staff and reports are fictional.', footerMap: 'Map data © OpenStreetMap contributors.',
    pillars: ['Tamil and English reports of the same problem are linked, never closed as duplicates.', 'Only a citizen can confirm an issue is fixed.', 'Every status change is written to a tamper-evident log.'],
  },
  ta: {
    report: 'புகார் அளிக்க', track: 'புகாரைக் கண்காணிக்க', board: 'நகரப் பலகை', about: 'எப்படிச் செயல்படுகிறது', staff: 'அலுவலர் உள்நுழைவு', emergency: 'அவசரமா? 112 ஐ அழைக்கவும்',
    emergencyNote: 'இந்தச் சேவை அவசரமில்லாத குடிமைப் பிரச்சினைகளுக்கு மட்டும்.',
    title: 'குடிமைப் பிரச்சினையைப் புகாரளிக்கவும்', lede: 'என்ன பிரச்சினை, எங்கே என்று சொல்லுங்கள். கண்காணிப்பு எண் கிடைக்கும்; சரிசெய்யப்பட்டதைக் குடிமக்கள் உறுதிசெய்யும் வரை தகவல் வரும்.',
    describe: 'என்ன பிரச்சினை?', describeHint: 'தமிழ் அல்லது ஆங்கிலத்தில் எழுதலாம்.', minChars: 'தொடர, பிரச்சினையைக் குறைந்தது 10 எழுத்துகளில் விவரிக்கவும்.',
    category: 'வகை', optional: 'கட்டாயமில்லை', location: 'இடம்', locationHint: 'சரியான இடத்தைக் குறிக்க வரைபடத்தில் தட்டவும் அல்லது குறியை இழுக்கவும்.',
    jumpTo: 'பகுதிக்குச் செல்ல', choose: 'தேர்ந்தெடுக்கவும்…', ward: 'வார்டு',
    landmark: 'அருகிலுள்ள அடையாளம்', landmarkEg: 'எ.கா. காந்திபுரம் பேருந்து நிலையம்', contact: 'தகவல் பெற தொலைபேசி எண்', photo: 'புகைப்படம்', addPhoto: 'புகைப்படம் சேர்க்க', removePhoto: 'நீக்கு',
    submit: 'புகாரைச் சமர்ப்பிக்கவும்', submitting: 'சமர்ப்பிக்கப்படுகிறது…',
    dupTitle: 'அருகில் ஏற்கனவே புகாரளிக்கப்பட்டதா?', dupLede: 'ஏற்கனவே உள்ள பிரச்சினையைப் பின்தொடர்ந்தால் அதன் முன்னுரிமை உயரும்; எல்லாத் தகவலும் உங்களுக்கு வரும்.',
    follow: 'இதைப் பின்தொடரவும்', following: 'பின்தொடர்கிறது…', noDup: 'அருகில் இதுபோன்ற பிரச்சினை இல்லை. இது புதிய புகாராகும்.', checking: 'அருகிலுள்ள புகார்களைச் சரிபார்க்கிறது…',
    dupWait: 'பிரச்சினையை விவரிக்கத் தொடங்குங்கள்; அருகிலுள்ள இதுபோன்ற புகார்களைத் தமிழிலும் ஆங்கிலத்திலும் சரிபார்ப்போம்.',
    likelySame: 'அநேகமாக இதே பிரச்சினை', possiblySame: 'இதுவாக இருக்கலாம்', crossLang: 'தமிழ் ↔ ஆங்கிலம்',
    yourReport: 'உங்கள் புகார்', existing: 'ஏற்கனவே உள்ள புகார்', meaning: 'பொருள்', distance: 'தூரம்', time: 'நேர இடைவெளி',
    mAway: m => `${m} மீ தொலைவில்`, hApart: h => `${h} மணி நேர இடைவெளி`, whyMatch: 'ஏன் இப்படிக் கருதுகிறோம்',
    routeTitle: 'பொறுப்பான துறை (பரிந்துரை)', routeLede: 'உங்கள் விவரம் மற்றும் இடத்தின் அடிப்படையில். அலுவலர்கள் உறுதி செய்வர்.',
    tier: { high: 'அதிக நம்பிக்கை', medium: 'நடுத்தரம் · அலுவலர் உறுதிசெய்வர்', low: 'குறைவு · அலுவலர் பரிசீலிப்பர்' },
    received: 'புகார் பெறப்பட்டது', followed: 'இப்போது இந்தப் பிரச்சினையைப் பின்தொடர்கிறீர்கள்', yourId: 'உங்கள் கண்காணிப்பு எண்',
    secret: 'இந்த எண் ஒரு சாவி போன்றது: இது உள்ள எவரும் உங்கள் புகாரைப் பார்க்கலாம். இதை யாருடனும் பகிர வேண்டாம்; முன்னேற்றத்தைப் பார்க்கச் சேமித்து வையுங்கள்.',
    copy: 'எண்ணை நகலெடு', copied: 'நகலெடுக்கப்பட்டது', trackThis: 'இந்தப் புகாரைக் கண்காணிக்க', another: 'மற்றொரு புகார் அளிக்க',
    trackTitle: 'உங்கள் புகாரைக் கண்காணிக்கவும்', trackLede: 'புகாரளித்தபோது கிடைத்த கண்காணிப்பு எண்ணை உள்ளிடவும்.', trackingId: 'கண்காணிப்பு எண்', trackBtn: 'கண்காணி',
    dept: 'துறை', due: 'தீர்வுக் காலக்கெடு', citizens: n => `${n} பேர் இதைப் புகாரளித்துள்ளனர்`, reportsLabel: 'புகாரளித்த குடிமக்கள்',
    escalated: 'மேலதிகாரிக்கு அனுப்பப்பட்டது', stopped: 'காலக்கெடு நிறுத்தப்பட்டது: தீர்க்கப்பட்டதாகக் குறிக்கப்பட்டது', overdueBy: s => `${s} தாமதம்`, dueIn: s => `இன்னும் ${s}`,
    timeline: 'பொதுக் காலவரிசை', notifications: 'உங்களுக்கான அறிவிப்புகள்', wasFixed: 'சரி செய்யப்பட்டதா?', fixedLede: 'துறை இதைத் தீர்த்ததாகக் குறித்துள்ளது. குடிமக்கள் மட்டுமே இதை உறுதிசெய்ய முடியும்.',
    yes: 'ஆம், சரி செய்யப்பட்டது', no: 'இல்லை, மீண்டும் திறக்கவும்', reopenNote: 'இன்னும் என்ன பிரச்சினை?', sendReopen: 'மீண்டும் திறக்கவும்', cancel: 'ரத்துசெய்',
    closure: 'மூடல் காரணம்', evidence: 'ஆதாரம்', awaitingTriage: 'அலுவலர் பரிசீலித்து ஒதுக்குவதற்காகக் காத்திருக்கிறது.',
    thanksFixed: 'நன்றி. குடிமகன் உறுதிசெய்ததாகப் பிரச்சினை மூடப்பட்டது.', thanksReopen: 'பிரச்சினை மீண்டும் திறக்கப்பட்டு துறைக்கு அனுப்பப்பட்டது.',
    steps: ['சமர்ப்பிக்கப்பட்டது', 'ஒதுக்கப்பட்டது', 'ஏற்கப்பட்டது', 'நடைபெறுகிறது', 'தீர்க்கப்பட்டது', 'மூடப்பட்டது'],
    status: { Triage: 'பரிசீலனையில்', Submitted: 'சமர்ப்பிக்கப்பட்டது', Assigned: 'ஒதுக்கப்பட்டது', Acknowledged: 'ஏற்கப்பட்டது', 'In progress': 'நடைபெறுகிறது', Resolved: 'தீர்க்கப்பட்டது', Closed: 'மூடப்பட்டது', Reopened: 'மீண்டும் திறக்கப்பட்டது', Rejected: 'நிராகரிக்கப்பட்டது', Escalated: 'மேலதிகாரிக்கு அனுப்பப்பட்டது' },
    boardTitle: 'நகரப் பொறுப்புக்கூறல் பலகை', boardLede: 'பொதுப் பொறுப்புக்கூறல் — ஒவ்வொரு துறையின் செயல்பாடும் ஒவ்வொரு குடிமகனுக்கும் தெரியும்.',
    updated: 'புதுப்பிக்கப்பட்டது', reports: 'புகார்கள்', issues: 'பிரச்சினைகள்', open: 'நிலுவையில்', overdue: 'காலக்கெடு தாண்டியவை', medianResolve: 'தீர்வுக்கான இடைநிலை நேரம்',
    gapTitle: 'துறைகள் மூடியவை vs குடிமக்கள் உறுதிசெய்தவை', closedRate: 'மூடப்பட்டதாகக் குறிக்கப்பட்டவை', verifiedRate: 'குடிமக்கள் உறுதிசெய்தவை',
    gapNote: g => `“மூடப்பட்ட” பணிகளில் ${g} சதவீதப் புள்ளிகளை இன்னும் எந்தக் குடிமகனும் உறுதிசெய்யவில்லை.`,
    leaderboard: 'துறைவாரியான செயல்பாடு', sortBy: 'வரிசைப்படுத்து', sortOverdue: 'அதிகத் தாமதம்', sortResolve: 'மெதுவான தீர்வு', sortVerified: 'குறைந்த உறுதிப்படுத்தல்',
    resolved: 'தீர்க்கப்பட்டவை', verified: 'உறுதிசெய்யப்பட்டவை', ack: 'ஏற்க ஆன இடைநிலை நேரம்', bounces: 'திருப்பி அனுப்பியவை', hours: h => h == null ? '—' : `${h < 10 ? h.toFixed(1) : Math.round(h)} மணி`,
    byCategory: 'வகைவாரியாக நிலுவையில் உள்ள பிரச்சினைகள்', boardFoot: 'எண்கள் நேரடியாகப் பிரச்சினைப் பதிவேட்டிலிருந்து வருகின்றன. கற்பனைத் தரவுடன் கூடிய முன்னோட்டத் திட்டம்.',
    footer: 'கோயம்புத்தூருக்கான முன்னோட்டத் திட்டம். வார்டுகள், அலுவலர்கள், புகார்கள் அனைத்தும் கற்பனையானவை.', footerMap: 'வரைபடத் தரவு © OpenStreetMap பங்களிப்பாளர்கள்.',
    pillars: ['ஒரே பிரச்சினை பற்றிய தமிழ், ஆங்கிலப் புகார்கள் இணைக்கப்படும்; நகல் என்று மூடப்படாது.', 'பிரச்சினை சரியானதைக் குடிமகன் மட்டுமே உறுதிசெய்ய முடியும்.', 'ஒவ்வொரு நிலை மாற்றமும் மாற்ற முடியாத பதிவேட்டில் எழுதப்படும்.'],
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
      <img src="/favicon.svg" alt="" className="size-9" />
      <span className="leading-tight">
        <span className="display block text-[19px] font-bold tracking-tight text-ink">{APP_NAME}</span>
        <span className="block text-[12.5px] text-ink-2">{sub}</span>
      </span>
    </Link>
  )
}

