import { Icon, fmtTime, relDue } from './ui'

const L = {
  en: { title: 'Dispatch trail', owner: 'Current owner', step: 'Next step', sent: 'Sent', received: 'Received', awaiting: 'Awaiting receipt', passed: 'Passed on without receipt', due: 'due', by: 'by', none: 'Not dispatched yet — waiting for triage.' },
  ta: { title: 'அனுப்புதல் வழித்தடம்', owner: 'தற்போதைய பொறுப்பு', step: 'அடுத்த படி', sent: 'அனுப்பப்பட்டது', received: 'பெறப்பட்டது', awaiting: 'பெறப்படவில்லை', passed: 'பெறாமலே அடுத்த துறைக்கு அனுப்பப்பட்டது', due: 'காலக்கெடு', by: '—', none: 'இன்னும் அனுப்பப்படவில்லை — பரிசீலனைக்காகக் காத்திருக்கிறது.' },
}

/* Every hop between departments: Sent (assigned / handed over) and Received (acknowledged).
   Staff see who did it and can jump to the audit event; citizens see departments and times only. */
export function DispatchTrail({ d, lang = 'en', onJump }) {
  const l = L[lang] || L.en
  if (!d) return null
  const due = d.next_due ? relDue(d.next_due) : null
  const chip = (ok, children, hash) => {
    const cls = `inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold ring-1 ${ok === true ? 'bg-ok-soft text-ok ring-ok/25' : ok === 'bad' ? 'bg-bad-soft text-bad ring-bad/25' : ok === 'wait' ? 'bg-warn-soft text-warn ring-warn/25' : 'bg-navy-soft text-navy ring-navy/20'}`
    return onJump && hash
      ? <button type="button" className={`${cls} hover:brightness-95`} onClick={() => onJump(hash)} title="Open the audit event">{children}<Icon name="link" className="size-3.5 opacity-60" /></button>
      : <span className={cls}>{children}</span>
  }
  return (
    <div>
      <dl className="grid gap-px overflow-hidden rounded-lg bg-line/60 ring-1 ring-line/60 sm:grid-cols-2">
        <div className="bg-card px-4 py-3"><dt className="ta text-[12.5px] text-ink-2">{l.owner}</dt><dd className="font-bold">{d.owner}</dd></div>
        <div className="bg-card px-4 py-3"><dt className="ta text-[12.5px] text-ink-2">{l.step}</dt>
          <dd className="font-bold">{d.next_step}{due && <span className={`ml-2 text-[13px] font-semibold ${due.overdue ? 'text-bad' : 'text-ink-2'}`}>· {due.text}</span>}</dd></div>
      </dl>
      {d.hops.length === 0 ? <p className="ta mt-3 text-ink-2">{l.none}</p> : (
        <ol className="mt-4 space-y-3">
          {d.hops.map((h, n) => {
            const last = n === d.hops.length - 1
            const waiting = !h.received_at && last && ['Assigned', 'Reopened'].includes(d.status)
            return (
              <li key={n} className="relative rounded-lg bg-sunk/50 p-3 ring-1 ring-line/60">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="grid size-6 place-items-center rounded-full bg-navy text-[11px] text-white">{n + 1}</span>
                  <span>{h.from}</span><Icon name="arrow" className="size-4 text-ink-2" /><span className="text-navy">{h.to}</span>
                </p>
                {h.reason && h.from !== 'Triage desk' && <p className="mt-1 text-[14px] text-ink-2">“{h.reason}”</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {chip(null, <><Icon name="arrow" className="size-3.5" /><span className="ta">{l.sent}</span> {fmtTime(h.sent_at)}{h.sent_by ? ` · ${h.sent_by}` : ''}</>, h.sent_hash)}
                  {h.received_at
                    ? chip(true, <><Icon name="check" className="size-3.5" /><span className="ta">{l.received}</span> {fmtTime(h.received_at)}{h.received_by ? ` · ${h.received_by}` : ''}</>, h.received_hash)
                    : waiting ? chip(due?.overdue ? 'bad' : 'wait', <><Icon name="clock" className="size-3.5" /><span className="ta">{l.awaiting}</span>{due ? ` · ${due.text}` : ''}</>)
                    : chip(null, <span className="ta">{l.passed}</span>)}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

/* Short how-tos for staff: send, receive, track. */
export function Guides() {
  const items = [
    ['Send work to another department', ['Open the issue, choose “Reject to another dept”.', 'Pick the department that should own it and give a reason.', 'It shows as Sent on the trail until they receive it — ownership is never empty.']],
    ['Receive work sent to you', ['Open Dispatch → Incoming, or the issue itself.', 'Press “Acknowledge” — that is the Received stamp, with your name and time.', 'The resolve clock and next step appear straight away.']],
    ['Track where an issue is', ['The Dispatch trail lists every hop: from → to, sent, received.', 'Amber means awaiting receipt, red means the receipt deadline passed.', 'Click a chip to open the exact audit event (who, when, hash).']],
  ]
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {items.map(([title, steps]) => (
        <details key={title} className="group rounded-lg bg-card/80 p-3 ring-1 ring-line/70 open:ring-navy/30">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Icon name="layers" className="size-4 text-navy" />{title}<Icon name="arrow" className="ml-auto size-4 text-ink-2 transition-transform group-open:rotate-90" /></summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[14px] text-ink-2">{steps.map(s => <li key={s}>{s}</li>)}</ol>
        </details>
      ))}
    </div>
  )
}
