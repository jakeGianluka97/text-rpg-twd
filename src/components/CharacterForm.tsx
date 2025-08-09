'use client'
import { useState } from 'react'

export default function CharacterForm({ onReady }: { onReady: (id: string)=>void }) {
  const [name, setName] = useState('Jake Milton')
  const [motherTongue, setMotherTongue] = useState('it')
  const [known, setKnown] = useState<string>('nap')
  const create = async () => {
    const res = await fetch('/api/character/upsert', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, motherTongue, known: [known] })
})

let data: any = null
if (res.ok) {
  try { data = await res.json() } 
  catch { const t = await res.text(); throw new Error(`Parse error: ${t.slice(0,200)}`) }
} else {
  const t = await res.text()
  throw new Error(`API ${res.status}: ${t.slice(0,200)}`)
}

onReady?.(data.id)
  }
  return (
    <div className="space-y-3">
      <input className="w-full p-2 rounded bg-zinc-800" value={name} onChange={e=>setName(e.target.value)} />
      <div className="flex gap-2">
        <label>Lingua madre</label>
        <select value={motherTongue} onChange={e=>setMotherTongue(e.target.value)} className="bg-zinc-800 p-2 rounded">
          <option value="it">Italiano</option>
          <option value="es">Spagnolo</option>
          <option value="en_us">Inglese (USA)</option>
        </select>
      </div>
      <div className="flex gap-2">
        <label>Dialetto/Lingua nota</label>
        <select value={known} onChange={e=>setKnown(e.target.value)} className="bg-zinc-800 p-2 rounded">
          <option value="nap">Napoletano</option>
          <option value="es">Spagnolo</option>
          <option value="en_us">Inglese (USA)</option>
        </select>
      </div>
      <button onClick={create} className="px-3 py-2 bg-emerald-600 rounded">Salva/Usa</button>
    </div>
  )
}
