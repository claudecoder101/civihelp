import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, getStaff, setSession } from '../api'
import { ErrorBox, Icon } from '../ui'

/* Supervisor/admin only: restores the seeded demo dataset, then signs everyone out. */
export default function ResetDemo() {
  const staff = getStaff()
  const dlg = useRef(null)
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  if (!['supervisor', 'admin'].includes(staff?.role)) return null

  async function reset() {
    setBusy(true); setErr(null)
    try {
      await api('/api/admin/reset-demo', { method: 'POST' })
      setSession(null, null)
      nav('/login/staff', { replace: true })
    } catch (e) { setErr(e); setBusy(false) }
  }

  return (
    <section className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-dashed border-line bg-card p-5" aria-labelledby="reset-h">
      <span className="grid size-10 place-items-center rounded-lg bg-warn-soft text-warn"><Icon name="refresh" className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <h2 id="reset-h" className="font-bold">Demo controls</h2>
        <p className="text-[15px] text-ink-2">Restore the original demo dataset. Visible to supervisors and admins only.</p>
      </div>
      <button className="btn btn-ghost" onClick={() => { setErr(null); dlg.current?.showModal() }}>
        <Icon name="refresh" />Reset demo data
      </button>

      <dialog ref={dlg} aria-labelledby="reset-t" className="m-auto w-[min(92vw,440px)] rounded-xl bg-card p-0 text-ink shadow-[0_24px_64px_-12px_rgba(14,34,71,.45)] backdrop:bg-[#0e2247]/50 backdrop:backdrop-blur-[2px]">
        <div className="p-6">
          <span className="grid size-11 place-items-center rounded-lg bg-warn-soft text-warn"><Icon name="alert" className="size-6" /></span>
          <h3 id="reset-t" className="mt-4 text-xl font-extrabold tracking-tight">Reset demo data?</h3>
          <p className="mt-1.5 text-ink-2">This restores the original demo dataset and logs everyone out. Reports, issues and audit events created since the last reset are discarded.</p>
          <div className="mt-3"><ErrorBox error={err} /></div>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => dlg.current?.close()} disabled={busy} autoFocus>Cancel</button>
            <button className="btn btn-bad" onClick={reset} disabled={busy}><Icon name="refresh" />{busy ? 'Resetting…' : 'Reset and sign out'}</button>
          </div>
        </div>
      </dialog>
    </section>
  )
}
