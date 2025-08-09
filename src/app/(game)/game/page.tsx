'use client'
import { useEffect, useState } from 'react'
import Chat from '@/components/Chat'
import CharacterForm from '@/components/CharacterForm'
import MapView from '@/components/MapView'
import RelationshipsPanel from '@/components/RelationshipsPanel'
import Timeline from '@/components/Timeline'
import DebugBar from '@/components/DebugBar'

type Loc = { lat: number; lon: number; name?: string } | null

export default function GamePage() {
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [currentLoc, setCurrentLoc] = useState<Loc>(null)
  const [debugScene, setDebugScene] = useState<any>(null)
  const [debugEvents, setDebugEvents] = useState<any[]>([])

  // ricarica ultimo PG
  useEffect(() => {
    try {
      const last = localStorage.getItem('twd:lastCharacterId')
      if (last) setCharacterId(last)
    } catch {}
  }, [])

  const handleReady = (id: string) => {
    try { localStorage.setItem('twd:lastCharacterId', id) } catch {}
    setCharacterId(id)
  }

  useEffect(() => {
  if (characterId) console.log('ID Personaggio:', characterId)
}, [characterId])

useEffect(() => {
  if (!characterId) return
  fetch(`/api/scene-state?characterId=${characterId}`).then(r=>r.json()).then(d=>setDebugScene(d.state))
  fetch(`/api/events?characterId=${characterId}`).then(r=>r.json()).then(d=>setDebugEvents(d.events))
}, [characterId])

  return (
    <main className="grid xl:grid-cols-3 lg:grid-cols-2 gap-6 p-6">
      <section>
        <h2 className="text-xl font-semibold mb-2">Personaggio</h2>
        <CharacterForm onReady={handleReady} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Relazioni</h2>
        <RelationshipsPanel characterId={characterId} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Timeline</h2>
        <Timeline characterId={characterId} />
      </section>

      <section className="xl:col-span-1 lg:col-span-2">
        <h2 className="text-xl font-semibold mb-2">Mappa</h2>
        <MapView current={currentLoc ?? undefined} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Chat con il GM</h2>
        <Chat
          characterId={characterId}
          onLocationChange={(loc) => setCurrentLoc(loc ?? null)}
        />
      </section>
      <DebugBar characterId={characterId} scene={debugScene} events={debugEvents} />

    </main>
  )
}
