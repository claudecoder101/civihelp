import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { api } from '../api'
import { Badge, ErrorBox, Icon, Loading, TierBadge, useLang, useMeta } from '../ui'

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
  const [contact, setContact] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoErr, setPhotoErr] = useState(null)
  const [check, setCheck] = useState({ data: null, loading: false, error: null })
  const [submitting, setSubmitting] = useState(null) // null | 'new' | issue_id
  const [submitErr, setSubmitErr] = useState(null)
  const [done, setDone] = useState(null)
  const seq = useRef(0)

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

  if (done) return <Success done={done} t={t} onAnother={reset} />
  if (metaError) return <ErrorBox error={metaError} onRetry={() => location.reload()} />
  if (!meta || !pos) return <Loading />

  const dups = check.data?.duplicates || []
  const routes = check.data?.routing || []

  return (
    <div className="rise">
      <h1 className="max-w-3xl text-[clamp(1.9rem,3.6vw,2.75rem)] font-extrabold leading-[1.08] tracking-tight">{t.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">{t.lede}</p>

      <form onSubmit={e => { e.preventDefault(); submit() }}
        className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start" noValidate>
        {/* 1. Description — first on every width */}
        <section className="rounded-lg bg-card p-5 sm:p-6 lg:col-start-1">
          <label htmlFor="desc" className="label text-base">{t.describe}</label>
          <p id="desc-hint" className="mb-2 text-sm text-ink-2">{t.describeHint}</p>
          <textarea id="desc" rows={4} value={text} onChange={e => setText(e.target.value)} aria-describedby="desc-hint"
            className="field ta resize-y text-[17px]" required
            placeholder={'e.g. Garbage bin overflowing near the bus stop for 3 days\nஎ.கா. பேருந்து நிறுத்தம் அருகே குப்பைத் தொட்டி 3 நாட்களாக நிரம்பி வழிகிறது'} />

          <fieldset className="mt-5">
            <legend className="label">{t.category} <span className="font-normal text-ink-2">({t.optional})</span></legend>
            <div className="flex flex-wrap gap-2">
              {meta.categories.map(c => {
                const on = category === c.id
                return (
                  <button type="button" key={c.id} aria-pressed={on} onClick={() => setCategory(on ? null : c.id)}
                    className={`min-h-10 rounded-full px-4 text-[15px] font-semibold transition-colors ${on ? 'bg-navy text-white' : 'bg-sunk text-ink hover:bg-[#dde3e0]'}`}>
                    {lang === 'ta' ? c.name_ta : c.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </section>

        {/* 2. Live checks — beside the form on desktop, right under the description on phones */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-live="polite">
          <section className="rounded-lg bg-card p-5">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Icon name="users" className="size-5 text-navy" />{t.dupTitle}</h2>
            {!ready && <p className="mt-2 text-ink-2">{t.dupWait}</p>}
            {ready && check.loading && !check.data && <Loading label={t.checking} />}
            {check.error && <div className="mt-3"><ErrorBox error={check.error} /></div>}
            {ready && check.data && (dups.length === 0
              ? <p className="mt-2 text-ink-2">{t.noDup}</p>
              : <>
                <p className="mt-1 text-[15px] text-ink-2">{t.dupLede}</p>
                <ul className="mt-4 space-y-3">
                  {dups.map(d => (
                    <li key={d.issue_id} className={`rounded-md p-4 ${d.probable ? 'bg-ok-soft' : 'bg-sunk'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-2xl font-extrabold tnum text-ink">{Math.round(d.similarity * 100)}%</span>
                        <span className="text-sm text-ink-2">meaning match</span>
                        {d.probable && <Badge tone="solidOk" className="ml-auto">Likely the same issue</Badge>}
                      </div>
                      <p className="ta mt-2 line-clamp-3 text-[15px]">“{d.sample_text}”</p>
                      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2 tnum">
                        <div className="flex items-center gap-1"><Icon name="pin" /><dt className="sr-only">Distance</dt><dd>{Math.round(d.distance_m)} m away</dd></div>
                        <div className="flex items-center gap-1"><Icon name="clock" /><dt className="sr-only">Time apart</dt><dd>{Math.round(d.hours_apart)} h apart</dd></div>
                        <div className="flex items-center gap-1"><Icon name="users" /><dt className="sr-only">Reports</dt><dd>{t.citizens(d.report_count)}</dd></div>
                      </dl>
                      {d.reasons?.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink">
                          {d.reasons.map(r => <li key={r}>{r}</li>)}
                        </ul>
                      )}
                      <button type="button" className="btn btn-primary btn-sm mt-3 w-full" disabled={!!submitting} onClick={() => submit(d.issue_id)}>
                        {submitting === d.issue_id ? t.following : t.follow}
                      </button>
                    </li>
                  ))}
                </ul>
              </>)}
          </section>

          {routes.length > 0 && (
            <section className="rounded-lg bg-card p-5">
              <h2 className="text-lg font-bold">{t.routeTitle}</h2>
              <p className="text-[15px] text-ink-2">{t.routeLede}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-navy">{routes[0].dept_name}</span>
                <TierBadge tier={routes[0].tier} />
              </div>
              {check.data?.ward && <p className="mt-1 text-sm text-ink-2">Ward: {check.data.ward.name}</p>}
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm">
                {routes[0].reasons.map(r => <li key={r}>{r}</li>)}
              </ul>
            </section>
          )}
        </aside>

        {/* 3. Where + extras + submit */}
        <section className="space-y-5 rounded-lg bg-card p-5 sm:p-6 lg:col-start-1">
          <div>
            <h2 className="label text-base">{t.location}</h2>
            <p className="mb-2 text-sm text-ink-2">{t.locationHint}</p>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <span className="text-ink-2">Jump to area</span>
              <select className="rounded-md border border-line bg-card px-2 py-1.5" defaultValue=""
                onChange={e => { const w = meta.wards.find(w => String(w.id) === e.target.value); if (w) setPos([w.lat, w.lng]) }}>
                <option value="" disabled>Choose…</option>
                {meta.wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <div className="h-[300px] overflow-hidden rounded-md sm:h-[360px]">
              <MapContainer center={pos} zoom={14} scrollWheelZoom={false} className="h-full w-full">
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={pos} draggable eventHandlers={{ dragend: e => { const l = e.target.getLatLng(); setPos([l.lat, l.lng]) } }} />
                <PinOnClick onPick={setPos} />
                <FollowPin pos={pos} />
              </MapContainer>
            </div>
            <p className="mt-1.5 text-sm text-ink-2 tnum">{pos[0].toFixed(5)}, {pos[1].toFixed(5)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="landmark" className="label">{t.landmark} <span className="font-normal text-ink-2">({t.optional})</span></label>
              <input id="landmark" className="field ta" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Gandhipuram bus stand" />
            </div>
            <div>
              <label htmlFor="contact" className="label">{t.contact} <span className="font-normal text-ink-2">({t.optional})</span></label>
              <input id="contact" className="field" type="tel" inputMode="tel" autoComplete="tel" value={contact} onChange={e => setContact(e.target.value)} placeholder="+91 98xxxxxxxx" />
            </div>
          </div>

          <div>
            <span className="label">{t.photo} <span className="font-normal text-ink-2">({t.optional})</span></span>
            {photo ? (
              <div className="flex items-center gap-4">
                <img src={photo} alt="Selected photo preview" className="h-24 w-32 rounded-md object-cover" />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPhoto(null)}><Icon name="x" />{t.removePhoto}</button>
              </div>
            ) : (
              <label className="btn btn-ghost">
                <Icon name="camera" className="size-5" />{t.addPhoto}
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPhoto} />
              </label>
            )}
            {photoErr && <p role="alert" className="mt-1 text-sm text-bad">{photoErr}</p>}
          </div>

          <ErrorBox error={submitErr} />
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="btn btn-primary px-6 text-[17px]" disabled={!ready || !!submitting}>
              {submitting === 'new' ? t.submitting : t.submit}
            </button>
            {!ready && <span className="text-sm text-ink-2">{t.describe} (10+)</span>}
          </div>
        </section>
      </form>
    </div>
  )
}

function Success({ done, t, onAnother }) {
  return (
    <section className="rise mx-auto max-w-2xl rounded-lg bg-card p-6 sm:p-10" aria-live="polite">
      <p className="flex items-center gap-2 text-lg font-bold text-ok"><Icon name="check" className="size-6" />{done.followed ? t.followed : t.received}</p>
      <p className="mt-6 text-ink-2">{t.yourId}</p>
      <p className="mt-1 select-all text-[clamp(3rem,10vw,5.5rem)] font-extrabold leading-none tracking-tight text-navy tnum">{done.id}</p>
      <p className="mt-3 text-ink-2">{t.save}{done.ward?.name ? ` · Ward: ${done.ward.name}` : ''}</p>
      {done.next_steps && <p className="mt-6 rounded-md bg-navy-soft p-4 text-[17px] text-ink">{done.next_steps}</p>}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to={`/track/${done.id}`} className="btn btn-primary">{t.trackThis}</Link>
        <button className="btn btn-ghost" onClick={onAnother}>{t.another}</button>
      </div>
    </section>
  )
}
