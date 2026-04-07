'use client'

import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { onboardingHue } from '@/lib/steda-district-geo'

export interface DistrictMapRow {
  districtKey: string
  label: string
  listed: number
  joined: number
  onboardedPct: number
  lat: number
  lng: number
}

export default function StedaOnboardingMap({ districts }: { districts: DistrictMapRow[] }) {
  if (districts.length === 0) {
    return (
      <div className="h-[360px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-sm text-slate-500">
        No district data
      </div>
    )
  }

  return (
    <div className="h-[360px] sm:h-[420px] rounded-xl border border-slate-200 overflow-hidden shadow-inner bg-slate-100">
      <MapContainer
        center={[26.2, 68.4]}
        zoom={6}
        className="h-full w-full z-0"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {districts.map((d) => {
          const r = Math.min(26, 5 + Math.sqrt(d.listed) * 0.95)
          const color = onboardingHue(d.onboardedPct)
          return (
            <CircleMarker
              key={d.districtKey}
              center={[d.lat, d.lng]}
              radius={r}
              pathOptions={{
                color: '#0f172a',
                weight: 1,
                fillColor: color,
                fillOpacity: 0.62,
              }}
            >
              <Tooltip direction="top" offset={[0, -6]} opacity={1}>
                <div className="font-semibold text-slate-900">{d.label}</div>
                <div className="text-slate-600">
                  Onboarded {d.joined} / {d.listed} ({d.onboardedPct}%)
                </div>
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
