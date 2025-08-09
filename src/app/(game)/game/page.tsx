'use client'
import { useState } from 'react'
import Chat from '@/components/Chat'
import CharacterForm from '@/components/CharacterForm'
import MapView from '@/components/MapView'
import RelationshipsPanel from '@/components/RelationshipsPanel'
import Timeline from '@/components/Timeline'

export default function GamePage() {
  const [characterId, setCharacterId] = useState<string | null>(null)
  return (
    <main className="grid xl:grid-cols-3 lg:grid-cols-2 gap-6 p-6">
      <section>
        <h2 className="text-xl font-semibold mb-2">Personaggio</h2>
        <CharacterForm onReady={setCharacterId} />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">Relazioni</h2>
        <RelationshipsPanel characterId={characterId} />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">Timeline</h2>
        <Timeline />
      </section>
      <section className="xl:col-span-1 lg:col-span-2">
        <h2 className="text-xl font-semibold mb-2">Mappa</h2>
        <MapView />
      </section>
      <section>
        <h2 className="text-xl font-semibold mb-2">Chat con il GM</h2>
        <Chat characterId={characterId} />
      </section>
    </main>
  )
}
