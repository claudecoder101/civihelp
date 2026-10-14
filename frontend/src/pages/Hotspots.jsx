import { Link } from 'react-router-dom'
import { CircleMarker, Popup } from 'react-leaflet'
import { CityMap } from '../map'
import { ErrorBox, Icon, Loading, useApi, useMeta } from '../ui'
import { PageHead } from './StaffLayout'

export default function Hotspots() {
  const { data, error, loading, reload } = useApi('/api/hotspots')
  const { meta } = useMeta()
  if (error) return <ErrorBox error={error} onRetry={reload} />
  if ((loading && !data) || !meta) return <Loading />
  const rows = [...data.table].sort((a, b) => b.reports - a.reports)

  return (
    <div className="rise">
      <PageHead eyebrow="Where complaints cluster" title="Hotspots" sub="Each circle is one issue, sized by how many residents reported it. Red means overdue.">
        <span className="flex items-center gap-3 text-sm text-ink-2">
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-navy" aria-hidden />On time</span>
          <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-bad" aria-hidden />Overdue</span>
        </span>
        <button className="btn btn-ghost btn-sm" onClick={reload}><Icon name="refresh" />Refresh</button>
      </PageHead>

      <div className="h-[420px] overflow-hidden rounded-xl ring-1 ring-line/60 lg:h-[480px]">
        <CityMap center={[meta.city.lat, meta.city.lng]} zoom={13} wards={meta.wards}>
          {data.points.map(p => {
            const color = p.overdue ? '#b3261e' : '#16305f'
            return (
              <CircleMarker key={p.issue_id} center={[p.lat, p.lng]} radius={6 + Math.sqrt(p.report_count) * 5}
                pathOptions={{ color, weight: 2, fillColor: color, fillOpacity: 0.35 }}>
                <Popup>
                  <strong>Issue {p.issue_id}</strong> · <span style={{ textTransform: 'capitalize' }}>{p.category}</span><br />
                  {p.report_count} report{p.report_count === 1 ? '' : 's'} · {p.status}{p.overdue ? ' · overdue' : ''}<br />
                  <Link to={`/staff/issues/${p.issue_id}`}>Open issue</Link>
                </Popup>
              </CircleMarker>
            )
          })}
        </CityMap>
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl bg-card ring-1 ring-line/60">
        <table className="w-full min-w-[560px] text-left text-[15px]">
          <caption className="p-4 text-left text-lg font-bold">Ward × category</caption>
          <thead className="bg-sunk text-sm text-ink-2">
            <tr>{['Ward', 'Category', 'Reports', 'Issues', 'Overdue'].map(h => <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-sunk">
                <td className="px-4 py-2.5 font-semibold">{r.ward}</td>
                <td className="px-4 py-2.5 capitalize">{r.category}</td>
                <td className="px-4 py-2.5 tnum">
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-full bg-navy" style={{ width: `${Math.min(120, r.reports * 8)}px` }} aria-hidden />{r.reports}
                  </span>
                </td>
                <td className="px-4 py-2.5 tnum">{r.issues}</td>
                <td className={`px-4 py-2.5 tnum ${r.overdue ? 'font-bold text-bad' : 'text-ink-2'}`}>{r.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
