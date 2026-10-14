import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Marker, useMap, useMapEvents } from 'react-leaflet'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { api, getCitizen } from '../api'
import { reducedMotion, useStagger } from '../anim'
import { CityMap } from '../map'
import { Badge, ErrorBox, Icon, Loading, useLang, useMeta } from '../ui'

const isTamil = s => /[஀-௿]/.test(s || '')

function PinOnClick({ onPick }) {
  useMapEvents({ click: e => onPick([e.latlng.lat, e.latlng.lng]) })
  return null
}

function FollowPin({ pos }) {
  const map = useMap()
  useEffect(() => { if (!map.getBounds().contains(pos)) map.flyTo(pos, 16) }, [map, pos])
  return null
}

// Phone photos are several MB; shrink to ≤1280px JPEG before base64.
function shrinkPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => reject(new Error('That file is not an image we can read.'))
    img.src = URL.createObjectURL(file)
  })
}

export default function Report() {
  const { lang, t } = useLang()
  const { meta, error: metaError } = useMeta()
  const [text, setText] = useState('')
  const [category, setCategory] = useState(null)
  const [pos, setPos] = useState(null)
  const [landmark, setLandmark] = useState('')
  const citizen = getCitizen()
  const [contact, setContact] = useState(citizen?.mobile || '')
  const [photo, setPhoto] = useState(null)
  const [photoErr, setPhotoErr] = useState(null)
  const [check, setCheck] = useState({ data: null, loading: false, error: null })
  const [submitting, setSubmitting] = useState(null) // null | 'new' | issue_id
  const [submitErr, setSubmitErr] = useState(null)
  const [done, setDone] = useState(null)
  const seq = useRef(0)
  const scope = useStagger([!!meta])

  useEffect(() => { if (meta && !pos) setPos([meta.city.lat, meta.city.lng]) }, [meta, pos])

  const ready = text.trim().length >= 10 && pos
  useEffect(() => {
    if (!ready) { setCheck({ data: null, loading: false, error: null }); return }
    const id = ++seq.current
    setCheck(c => ({ ...c, loading: true }))
    const timer = setTimeout(() => {
      api('/api/reports/check', { body: { text: text.trim(), category, lat: pos[0], lng: pos[1] } }).then(
        data => id === seq.current && setCheck({ data, loading: false, error: null }),
        error => id === seq.current && setCheck({ data: null, loading: false, error }),
      )
    }, 700)
    return () => clearTimeout(timer)
  }, [text, category, pos, ready])

  async function submit(followId = null) {
    if (!ready) return
    setSubmitting(followId || 'new'); setSubmitErr(null)
    try {
      const res = await api('/api/reports', {
        body: {
          text: text.trim(), category, lat: pos[0], lng: pos[1],
          landmark: landmark.trim() || null, contact: contact.trim() || null,
          photo_base64: photo ? photo.split(',')[1] : null, follow_issue_id: followId,
        },
      })
      setDone({ ...res, followed: !!followId })
      window.scrollTo({ top: 0 })
    } catch (e) { setSubmitErr(e) } finally { setSubmitting(null) }
  }

  async function onPhoto(e) {
    const f = e.target.files?.[0]
    setPhotoErr(null)
    if (!f) return
    try { setPhoto(await shrinkPhoto(f)) } catch (err) { setPhotoErr(err.message) }
    e.target.value = ''
  }

  function reset() {
    setDone(null); setText(''); setCategory(null); setLandmark(''); setContact(''); setPhoto(null)
    if (meta) setPos([meta.city.lat, meta.city.lng])
  }

  // Reporting needs a (simulated) citizen login: blocks anonymous spam and fake reports.
  if (!citizen) return <Navigate to="/login/citizen" replace state={{ from: '/report' }} />
  if (done) return <Success done={done} t={t} onAnother={reset} />
  if (metaError) return <ErrorBox error={metaError} onRetry={() => location.reload()} />
  if (!meta || !pos) return <Loading />

  const dups = check.data?.duplicates || []
  const routes = check.data?.routing || []

  return (
    <div ref={scope}>
      <header data-stagger className="max-w-3xl">
        <h1 className="ta text-[clamp(1.8rem,3.4vw,2.55rem)] font-bold leading-[1.05] text-ink">{t.title}</h1>
        <p className="ta mt-3 max-w-2xl text-lg text-ink-2">{t.lede}</p>
      </header>

      <form onSubmit={e => { e.preventDefault(); submit() }}
        className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start" noValidate>
        {/* 1. Description — first on every width */}
        <section data-stagger className="card p-5 sm:p-6 lg:col-start-1">
          <label htmlFor="desc" className="label ta text-base">{t.describe}</label>
          <p id="desc-hint" className="ta mb-2 text-sm text-ink-2">{t.describeHint}</p>
          <textarea id="desc" rows={4} value={text} onChange={e => setText(e.target.value)} aria-describedby="desc-hint"
            className="field ta resize-y text-[17px]" required
            placeholder={'e.g. Garbage bin overflowing near the bus stop for 3 days\nஎ.கா. பேருந்து நிறுத்தம் அருகே குப்பைத் தொட்டி 3 நாட்களாக நிரம்பி வழிகிறது'} />

          <fieldset className="mt-5">
            <legend className="label ta">{t.category} <span className="font-normal text-ink-2">({t.optional})</span></legend>
            <div className="flex flex-wrap gap-2">
              {meta.categories.map(c => {
                const on = category === c.id
                return (
                  <button type="button" key={c.id} aria-pressed={on} onClick={() => setCategory(on ? null : c.id)}
                    className={`ta min-h-10 rounded-full px-4 text-[15px] font-semibold transition-colors ${on ? 'chip chip-on' : 'chip'}`}>
                    {lang === 'ta' ? c.name_ta : c.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </section>

        {/* 2. Live checks — beside the form on desktop, right under the description on phones */}
        <aside data-stagger className="space-y-4 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-live="polite">
          <section className="card p-5">
            <h2 className="ta flex items-center gap-2 text-xl font-bold"><Icon name="users" className="size-5 shrink-0 text-navy" />{t.dupTitle}</h2>
            {!ready && <p className="ta mt-2 text-ink-2">{t.dupWait}</p>}
            {ready && check.loading && !check.data && <Loading label={t.checking} />}
            {check.error && <div className="mt-3"><ErrorBox error={check.error} /></div>}
            {ready && check.data && (dups.length === 0
              ? <p className="ta mt-2 text-ink-2">{t.noDup}</p>
              : <>
                <p className="ta mt-1 text-[15px] text-ink-2">{t.dupLede}</p>
                <ul className="mt-4 space-y-4">
                  {dups.map(d => (
                    <DupCard key={d.issue_id} d={d} mine={text.trim()} t={t} busy={!!submitting}
                      following={submitting === d.issue_id} onFollow={() => submit(d.issue_id)} />
                  ))}
                </ul>
              </>)}
          </section>

          {routes.length > 0 && (
            <section className="card p-5">
              <h2 className="ta text-lg font-bold">{t.routeTitle}</h2>
              <p className="ta text-[15px] text-ink-2">{t.routeLede}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="display text-xl font-bold text-navy">{routes[0].dept_name}</span>
                <Badge tone={{ high: 'ok', medium: 'warn', low: 'bad' }[routes[0].tier] || 'neutral'}><span className="ta">{t.tier[routes[0].tier] || routes[0].tier}</span></Badge>
              </div>
              {check.data?.ward && <p className="ta mt-1 text-sm text-ink-2">{t.ward}: {check.data.ward.name}</p>}
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                {routes[0].reasons.map(r => <li key={r}>{r}</li>)}
              </ul>
            </section>
          )}
        </aside>

        {/* 3. Where + extras + submit */}
        <section data-stagger className="card space-y-5 p-5 sm:p-6 lg:col-start-1">
          <div>
            <h2 className="label ta text-base">{t.location}</h2>
            <p className="ta mb-2 text-sm text-ink-2">{t.locationHint}</p>
            <label className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="ta text-ink-2">{t.jumpTo}</span>
              <select className="min-h-10 rounded-md border border-line bg-card px-2 py-1.5" defaultValue=""
                onChange={e => { const w = meta.wards.find(w => String(w.id) === e.target.value); if (w) setPos([w.lat, w.lng]) }}>
                <option value="" disabled>{t.choose}</option>
                {meta.wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <CityMap center={pos} zoom={14} scrollWheelZoom={false} wards={meta.wards}
              className="h-[300px] overflow-hidden rounded-lg ring-1 ring-line sm:h-[360px]">
              <Marker position={pos} draggable eventHandlers={{ dragend: e => { const l = e.target.getLatLng(); setPos([l.lat, l.lng]) } }} />
              <PinOnClick onPick={setPos} />
              <FollowPin pos={pos} />
            </CityMap>
            <p className="mono mt-1.5 text-[13px] text-ink-2 tnum">{pos[0].toFixed(5)}, {pos[1].toFixed(5)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="landmark" className="label ta">{t.landmark} <span className="font-normal text-ink-2">({t.optional})</span></label>
              <input id="landmark" className="field ta" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder={t.landmarkEg} />
            </div>
            <div>
              <label htmlFor="contact" className="label ta">{t.contact} <span className="font-normal text-ink-2">({t.optional})</span></label>
              <input id="contact" className="field" type="tel" inputMode="tel" autoComplete="tel" value={contact} onChange={e => setContact(e.target.value)} placeholder="+91 98xxxxxxxx" />
            </div>
          </div>

          <div>
            <span className="label ta">{t.photo} <span className="font-normal text-ink-2">({t.optional})</span></span>
            {photo ? (
              <div className="flex items-center gap-4">
                <img src={photo} alt="Selected photo preview" className="h-24 w-32 rounded-md object-cover" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}><Icon name="x" /><span className="ta">{t.removePhoto}</span></button>
              </div>
            ) : (
              <label className="btn btn-ghost">
                <Icon name="camera" className="size-5" /><span className="ta">{t.addPhoto}</span>
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
              </label>
            )}
            {photoErr && <p role="alert" className="mt-1 text-sm text-bad">{photoErr}</p>}
          </div>

          <ErrorBox error={submitErr} />
          <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
            <button type="submit" className="btn btn-primary px-6 text-[17px]" disabled={!ready || !!submitting}>
              <span className="ta">{submitting === 'new' ? t.submitting : t.submit}</span>
            </button>
            {!ready && <span className="ta text-sm text-ink-2">{t.minChars}</span>}
          </div>
        </section>
      </form>
    </div>
  )
}

/* The hero moment: your words next to the existing report, with the three factors that link them. */
function DupCard({ d, mine, t, busy, following, onFollow }) {
  const el = useRef(null)
  const cross = isTamil(mine) !== isTamil(d.sample_text) || d.reasons?.some(r => /cross-language/i.test(r))
  const meaning = Math.round(d.similarity * 100)
  const verdict = d.strong ? 'strong' : d.probable ? 'probable' : null
  const skin = verdict === 'strong' ? 'ring-ok/40 bg-ok-soft/60' : verdict === 'probable' ? 'ring-warn/40 bg-warn-soft/60' : 'ring-line bg-sunk/60'

  useGSAP(() => {
    if (reducedMotion()) return
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })
    tl.from(el.current, { y: 16, opacity: 0, duration: 0.45 })
      .from('[data-side="mine"]', { x: -18, opacity: 0, duration: 0.45 }, '-=0.15')
      .from('[data-side="theirs"]', { x: 18, opacity: 0, duration: 0.45 }, '<')
      .from('[data-link]', { scale: 0.4, opacity: 0, duration: 0.35, ease: 'back.out(2)' }, '-=0.2')
      .from('[data-bar]', { scaleX: 0, transformOrigin: 'left center', duration: 0.7, ease: 'power2.out' }, '-=0.1')
      .from('[data-factor]', { y: 8, opacity: 0, stagger: 0.08, duration: 0.3 }, '<')
  }, { scope: el, dependencies: [d.issue_id] })

  return (
    <li ref={el} className={`rounded-xl p-4 ring-1 ${skin}`}>
      <div className="flex flex-wrap items-center gap-2">
        {verdict === 'strong' && <Badge tone="solidOk"><Icon name="check" /><span className="ta">{t.likelySame}</span></Badge>}
        {verdict === 'probable' && <Badge tone="warn"><span className="ta">{t.possiblySame}</span></Badge>}
        {cross && <Badge tone="navy"><Icon name="languages" />{t.crossLang}</Badge>}
        <span className="mono ml-auto text-[12.5px] text-ink-2">{d.issue_id}</span>
      </div>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-2">
        <figure data-side="mine" className="min-w-0 rounded-lg bg-card p-3">
          <figcaption className="ta text-[12.5px] font-semibold text-ink-2">{t.yourReport}</figcaption>
          <blockquote className="ta mt-1 line-clamp-4 text-[14.5px] leading-snug">{mine}</blockquote>
        </figure>
        <span data-link aria-hidden className="absolute left-1/2 top-1/2 z-10 hidden size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-navy text-white ring-4 ring-card sm:grid">
          <Icon name="link" className="size-3.5" />
        </span>
        <figure data-side="theirs" className="min-w-0 rounded-lg bg-card p-3">
          <figcaption className="ta text-[12.5px] font-semibold text-ink-2">{t.existing} · {t.citizens(d.report_count)}</figcaption>
          <blockquote className="ta mt-1 line-clamp-4 text-[14.5px] leading-snug">{d.sample_text}</blockquote>
        </figure>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div data-factor className="rounded-lg bg-card px-2 py-2.5">
          <dt className="ta text-[12px] font-semibold text-ink-2">{t.meaning}</dt>
          <dd className="display text-2xl font-bold tnum text-ink">{meaning}%</dd>
          <div className="bar mx-auto mt-1 h-1.5 w-full max-w-20 overflow-hidden rounded-full" aria-hidden>
            <div data-bar className={`h-full rounded-full ${verdict === 'strong' ? 'bg-ok' : verdict === 'probable' ? 'bg-warn' : 'bg-ink-2'}`} style={{ width: `${meaning}%` }} />
          </div>
        </div>
        <div data-factor className="rounded-lg bg-card px-2 py-2.5">
          <dt className="ta text-[12px] font-semibold text-ink-2">{t.distance}</dt>
          <dd className="display text-2xl font-bold tnum text-ink">{Math.round(d.distance_m)}<span className="text-sm font-semibold text-ink-2"> m</span></dd>
        </div>
        <div data-factor className="rounded-lg bg-card px-2 py-2.5">
          <dt className="ta text-[12px] font-semibold text-ink-2">{t.time}</dt>
          <dd className="display text-2xl font-bold tnum text-ink">{d.hours_apart < 10 ? d.hours_apart.toFixed(1) : Math.round(d.hours_apart)}<span className="text-sm font-semibold text-ink-2"> h</span></dd>
        </div>
      </dl>

      {d.reasons?.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="ta cursor-pointer font-semibold text-navy">{t.whyMatch}</summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-ink">
            {d.reasons.map(r => <li key={r}>{r}</li>)}
          </ul>
        </details>
      )}
      <button type="button" className="btn btn-primary btn-sm mt-3 w-full" disabled={busy} onClick={onFollow}>
        <Icon name="link" /><span className="ta">{following ? t.following : t.follow}</span>
      </button>
    </li>
  )
}

function Success({ done, t, onAnother }) {
  const el = useRef(null)
  const [copied, setCopied] = useState(false)
  useGSAP(() => {
    if (reducedMotion()) return
    gsap.timeline({ defaults: { ease: 'power3.out' } })
      .from('[data-head]', { y: 10, opacity: 0, duration: 0.4 })
      .from('[data-char]', { yPercent: 70, opacity: 0, duration: 0.45, stagger: 0.035 }, '-=0.1')
      .from('[data-after]', { y: 10, opacity: 0, duration: 0.4, stagger: 0.08 }, '-=0.2')
  }, { scope: el })

  async function copy() {
    try { await navigator.clipboard.writeText(done.id) } catch {
      // Clipboard API needs a secure context; fall back to selecting the text.
      const r = document.createRange(); r.selectNodeContents(el.current.querySelector('[data-id]'))
      const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand?.('copy')
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section ref={el} className="card mx-auto max-w-2xl overflow-hidden" aria-live="polite">
      <div className="tricolour" aria-hidden />
      <div className="p-6 sm:p-10">
        <p data-head className="ta flex items-center gap-2 text-lg font-bold text-ok">
          <span className="grid size-8 place-items-center rounded-full bg-ok text-white"><Icon name="check" className="size-5" /></span>
          {done.followed ? t.followed : t.received}
        </p>
        <p data-head className="ta mt-7 text-ink-2">{t.yourId}</p>
        <div className="stamp mt-2 flex flex-wrap items-center gap-3 bg-navy-soft/50 px-4 py-4 sm:px-6">
          <p data-id aria-label={done.id} className="min-w-0 select-all break-all text-[clamp(1.6rem,6.4vw,3rem)] font-medium leading-none text-navy tnum">
            {[...done.id].map((c, i) => <span key={i} data-char aria-hidden className="inline-block">{c}</span>)}
          </p>
          <button type="button" onClick={copy} className="btn btn-sm btn-primary ml-auto" aria-live="polite">
            <Icon name={copied ? 'check' : 'copy'} /><span className="ta">{copied ? t.copied : t.copy}</span>
          </button>
        </div>
        <p data-after className="ta mt-4 flex gap-2 rounded-md bg-warn-soft p-3 text-[15px] text-ink">
          <Icon name="key" className="mt-0.5 size-5 shrink-0 text-warn" />{t.secret}
        </p>
        {done.ward?.name && <p data-after className="ta mt-3 text-sm text-ink-2">{t.ward}: {done.ward.name}</p>}
        {done.next_steps && <p data-after className="mt-5 border-l-4 border-navy pl-4 text-[17px] text-ink">{done.next_steps}</p>}
        <div data-after className="mt-8 flex flex-wrap gap-3">
          <Link to={`/track/${done.id}`} className="btn btn-primary"><span className="ta">{t.trackThis}</span></Link>
          <button className="btn btn-ghost" onClick={onAnother}><span className="ta">{t.another}</span></button>
        </div>
      </div>
    </section>
  )
}
