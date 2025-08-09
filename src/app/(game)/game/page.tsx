'use client'
import { useEffect, useState } from 'react'
import Chat from '@/components/Chat'
import CharacterForm from '@/components/CharacterForm'
import MapView from '@/components/MapView'
import RelationshipsPanel from '@/components/RelationshipsPanel'
import Timeline from '@/components/Timeline'

type Loc = { lat: number; lon: number; name?: string } | null

export default function GamePage() {
  const [characterId, setCharacterId] = useState<string | null>(null)
  const [currentLoc, setCurrentLoc] = useState<Loc>(null)

  // ricarica ultimo PG al mount
  useEffect(() => {
    try {
      const last = localStorage.getItem('twd:lastCharacterId')
      if (last) setCharacterId(last)
    } catch {}
  }, [])

  // quando il form crea/seleleziona un PG
  const handleReady = (id: string) => {
    try { localStorage.setItem('twd:lastCharacterId', id) } catch {}
    setCharacterId(id)
  }

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
        {/* PASSA characterId così la timeline si aggiorna via SWR */}
        <Timeline characterId={characterId} />
      </section>

      <section className="xl:col-span-1 lg:col-span-2">
        <h2 className="text-xl font-semibold mb-2">Mappa</h2>
        {/* la mappa mostra il marker della posizione corrente */}
        <MapView current={currentLoc ?? undefined} />
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Chat con il GM</h2>
        <Chat
          characterId={characterId}
          // la chat emette la location ricevuta dal server; qui aggiorniamo la mappa
          onLocationChange={(loc) => setCurrentLoc(loc ?? null)}
        />
      </section>
    </main>
  )
}
