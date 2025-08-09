'use client'
import { useEffect, useRef } from 'react'
import maplibregl, { Map, Marker } from 'maplibre-gl'

type Loc = { lat: number; lon: number; name?: string } | undefined

export default function MapView({ current }: { current?: Loc }) {
  const mapRef = useRef<Map | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<Marker | null>(null)

  // init map 1 volta
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [14.2681, 40.8518], // Napoli
      zoom: 9,
      attributionControl: true,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    return () => map.remove()
  }, [])

  // crea/aggiorna marker posizione PG
  useEffect(() => {
    const map = mapRef.current
    if (!map || !current || current.lat == null || current.lon == null) return
    const lngLat: [number, number] = [current.lon, current.lat]

    if (!markerRef.current) {
      markerRef.current = new maplibregl.Marker({ color: '#10b981' }).setLngLat(lngLat).addTo(map)
    } else {
      markerRef.current.setLngLat(lngLat)
    }
    markerRef.current.setPopup(new maplibregl.Popup({ offset: 12 }).setText(current.name || 'Posizione attuale'))
    map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom(), 10), speed: 0.8 })
  }, [current?.lat, current?.lon, current?.name])

  return <div ref={containerRef} className="h-[420px] w-full rounded border border-zinc-800" />
}
