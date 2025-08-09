'use client'
import { useEffect, useState } from 'react'

export default function RelationshipsPanel({ characterId }: { characterId: string | null }) {
  const [rels, setRels] = useState<any[]>([])
  useEffect(() => {
    if (!characterId) return
    fetch(`/api/relationships?characterId=${characterId}`).then(r=>r.json()).then(d=>setRels(d.rels))
  }, [characterId])
  if (!characterId) return <div className="opacity-60">Crea un personaggio per vedere le relazioni.</div>
  return (
    <div className="space-y-3">
      {rels.length === 0 && <div className="opacity-60">Nessuna relazione registrata.</div>}
      {rels.map(r => (
        <div key={r.id} className="p-2 rounded border border-zinc-800">
          <div className="text-sm opacity-70">NPC #{r.objectId}</div>
          <div className="mt-1">Trust: <b>{r.trust.toFixed(2)}</b></div>
          <div>Fear: <b>{r.fear.toFixed(2)}</b></div>
          <div>Reputation: <b>{r.reputation.toFixed(2)}</b></div>
        </div>
      ))}
    </div>
  )
}
