'use client'
import { useEffect, useRef, useState } from 'react'
import maplibregl, { Map } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Loc = { id:string; name:string; lat:number; lon:number; dangerLevel:number; region:string }

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<Map | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const m = new maplibregl.Map({
      container: containerRef.current!,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [14.2681, 40.8529],
      zoom: 8
    })
    mapRef.current = m
    m.addControl(new maplibregl.NavigationControl())
    m.on('load', ()=> setReady(true))
    return () => m.remove()
  }, [])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    ;(async () => {
      const res = await fetch('/api/locations')
      const data = await res.json()
      const features = (data.locations as Loc[]).map(l => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [l.lon, l.lat] },
        properties: { id: l.id, name: l.name, danger: l.dangerLevel }
      }))
      const srcId = 'locations'
      if (mapRef.current!.getSource(srcId)) {
        const src: any = mapRef.current!.getSource(srcId)
        src.setData({ type: 'FeatureCollection', features })
      } else {
        mapRef.current!.addSource(srcId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
        mapRef.current!.addLayer({
          id: 'locations-circle',
          type: 'circle',
          source: srcId,
          paint: {
            'circle-radius': ['+', 5, ['*', 2, ['get', 'danger']]],
            'circle-color': [
              'interpolate', ['linear'], ['get', 'danger'],
              0, '#5eead4', 2, '#fde047', 4, '#f97316', 6, '#ef4444'
            ],
            'circle-opacity': 0.8
          }
        })
        mapRef.current!.addLayer({
          id: 'locations-labels',
          type: 'symbol',
          source: srcId,
          layout: { 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.2] },
          paint: { 'text-color': '#e5e7eb' }
        })
      }
    })()
  }, [ready])

  return <div className="h-[45vh] rounded border border-zinc-800" ref={containerRef} />
}
