import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorBox, Icon, Loading, num, pct, useApi } from '../ui'
import { C } from './Dashboard'
import { PageHead } from './StaffLayout'

const DUP_METRICS = [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['bcubed_f1', 'B-cubed F1'], ['recall_at_5', 'Recall@5']]

export default function Evaluation() {
  const { data: e, error, loading, reload } = useApi('/api/evaluation')
  if (loading && !e) return <Loading />
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if (!e) return null
  const dup = DUP_METRICS.map(([k, label]) => ({ label, ai: e.duplicates.ai[k], baseline: e.duplicates.baseline[k] }))

  return (
    <div className="rise">
      <PageHead title="Evaluation" sub="Measured on a labelled test set, recomputed live from the same code that runs the app." />

      <p role="note" className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-warn-soft px-4 py-3 text-warn">
        <Icon name="alert" className="size-5" />
        <strong>Synthetic labelled data — not real-world results.</strong>
        <span>{e.dataset.reports} reports in {e.dataset.issues} true issues.{e.dataset.note ? ` ${e.dataset.note}` : ''}</span>
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section n="Routing accuracy" sub="Does the suggested department match the labelled owner?">
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md bg-sunk">
            <Big k="Top-1" v={pct(e.routing.top1)} />
            <Big k="Top-3" v={pct(e.routing.top3)} />
            <Big k="Macro-F1" v={num(e.routing.macro_f1, 2)} />
          </div>
          <Confusion {...e.routing.confusion} />
        </Section>

        <Section n="Duplicate-cluster quality" sub={`AI (${e.model || 'multilingual embeddings'}) vs keyword baseline (TF-IDF), same candidates and thresholds.`}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dup} margin={{ left: -18, right: 8, top: 18 }} barGap={2}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="label" tick={{ fill: C.ink2, fontSize: 12.5 }} tickLine={false} axisLine={false} interval={0} />
              <YAxis domain={[0, 1]} tickFormatter={v => `${v * 100}%`} tick={{ fill: C.ink2, fontSize: 12.5 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={v => pct(v, 1)} contentStyle={{ borderRadius: 6, border: 'none', boxShadow: '0 4px 16px rgba(15,31,54,.15)' }} cursor={{ fill: '#f0f2f1' }} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Bar isAnimationActive={false} dataKey="ai" name="AI (meaning)" fill={C.navy} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="ai" position="top" formatter={v => Math.round(v * 100)} style={{ fontSize: 12, fill: C.navy, fontWeight: 700 }} />
              </Bar>
              <Bar isAnimationActive={false} dataKey="baseline" name="Baseline (keywords)" fill={C.grey} radius={[3, 3, 0, 0]}>
                <LabelList dataKey="baseline" position="top" formatter={v => Math.round(v * 100)} style={{ fontSize: 12, fill: C.ink2 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-sm text-ink-2">Pairwise precision/recall/F1 over report pairs; B-cubed F1 over clusters; Recall@5 = true issue among the top 5 candidates shown.</p>
        </Section>

        <Section n="Resolution latency" sub="Hours from report to resolved, on closed issues.">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-sunk">
            <Big k="Median" v={`${num(e.latency.median_h)} h`} />
            <Big k="90th percentile" v={`${num(e.latency.p90_h)} h`} />
          </div>
        </Section>

        <Section n="Overdue-case rate" sub="Open issues past their due time ÷ all open issues.">
          <div className="flex items-center gap-6">
            <p className={`text-6xl font-extrabold tracking-tight tnum ${e.overdue_rate > 0.2 ? 'text-bad' : 'text-ink'}`}>{pct(e.overdue_rate, 1)}</p>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-sunk" role="img" aria-label={`Overdue rate ${pct(e.overdue_rate, 1)}`}>
              <div className="h-full rounded-full bg-bad" style={{ width: `${Math.min(100, (e.overdue_rate || 0) * 100)}%` }} />
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ n, sub, children }) {
  return (
    <section className="rounded-lg bg-card p-5 sm:p-6">
      <h2 className="text-xl font-extrabold">{n}</h2>
      <p className="mb-4 text-[15px] text-ink-2">{sub}</p>
      {children}
    </section>
  )
}

const Big = ({ k, v }) => (
  <div className="bg-card p-4">
    <p className="text-sm text-ink-2">{k}</p>
    <p className="text-4xl font-extrabold tracking-tight tnum">{v}</p>
  </div>
)

function Confusion({ labels = [], matrix = [] }) {
  if (!labels.length) return null
  const max = Math.max(1, ...matrix.flat())
  const short = s => String(s).replace(/ department| dept/i, '').slice(0, 12)
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="border-separate border-spacing-1 text-center text-[13px] tnum">
        <caption className="mb-2 text-left text-sm font-semibold">Confusion matrix — rows: true department, columns: predicted</caption>
        <thead>
          <tr><th />{labels.map(l => <th key={l} scope="col" className="max-w-20 px-1 pb-1 align-bottom font-semibold text-ink-2" title={l}>{short(l)}</th>)}</tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th scope="row" className="whitespace-nowrap pr-2 text-right font-semibold text-ink-2" title={labels[i]}>{short(labels[i])}</th>
              {row.map((v, j) => {
                const a = v / max
                const diag = i === j
                return (
                  <td key={j} className="size-11 rounded-sm font-bold" title={`${labels[i]} → ${labels[j]}: ${v}`}
                    style={{ background: v ? (diag ? `rgba(18,105,59,${0.12 + a * 0.88})` : `rgba(179,38,30,${0.12 + a * 0.6})`) : '#f4f5f2', color: a > 0.5 ? '#fff' : '#0f1f36' }}>
                    {v || ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
