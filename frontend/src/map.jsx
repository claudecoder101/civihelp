import { useEffect, useRef, useState } from 'react'
import { CircleMarker, MapContainer, TileLayer, Tooltip } from 'react-leaflet'
import { useMeta } from './ui'

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// Demo switch: add ?offline to any URL to rehearse the venue-without-Wi-Fi fallback.
const forced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('offline')

/*
 * Leaflet map that survives a dead network. Tiles failing (or the browser being offline)
 * swaps the OSM layer for a drawn basemap: grid + labelled ward centroids. Markers and
 * click handlers passed as children keep working because coordinates never depended on tiles.
 */
export function CityMap({ center, zoom = 13, className = 'h-full w-full', wards, showWards = 'offline', children, ...mapProps }) {
  const { meta } = useMeta()
  const wardList = wards || meta?.wards || []
  const [offline, setOffline] = useState(() => forced() || (typeof navigator !== 'undefined' && navigator.onLine === false))
  const errors = useRef(0)

  useEffect(() => {
    const down = () => setOffline(true)
    const up = () => { if (!forced()) { errors.current = 0; setOffline(false) } }
    window.addEventListener('offline', down)
    window.addEventListener('online', up)
    return () => { window.removeEventListener('offline', down); window.removeEventListener('online', up) }
  }, [])

  // A couple of failed tiles can be a blip; three in a row with none loading means no tile server.
  const tileEvents = {
    tileerror: () => { if (++errors.current >= 3) setOffline(true) },
    tileload: () => { errors.current = 0 },
  }
  const drawWards = showWards === 'always' || (showWards === 'offline' && offline)

  return (
    <div className={`relative ${className}`}>
      <MapContainer center={center} zoom={zoom} className={`h-full w-full ${offline ? 'map-offline' : ''}`} {...mapProps}>
        {!offline && <TileLayer attribution={ATTR} url={TILE_URL} eventHandlers={tileEvents} />}
        {drawWards && wardList.map(w => (
          <CircleMarker key={w.id} center={[w.lat, w.lng]} radius={5} interactive={false}
            pathOptions={{ color: '#16305f', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
            <Tooltip permanent direction="right" offset={[6, 0]} className="ward-label">{w.name}</Tooltip>
          </CircleMarker>
        ))}
        {children}
      </MapContainer>
      {offline && (
        <p role="status" className="pointer-events-none absolute bottom-2 left-2 z-[500] flex items-center gap-1.5 rounded-md bg-ink/90 px-2.5 py-1 text-[12.5px] font-semibold text-white">
          <span className="size-1.5 rounded-full bg-saffron" aria-hidden />Offline map — positions still accurate
        </p>
      )}
    </div>
  )
}
