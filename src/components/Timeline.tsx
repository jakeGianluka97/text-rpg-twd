'use client'
import { useEffect, useState } from 'react'
type Ev = { id:string; kind:string; summary:string; ts:string }
export default function Timeline() {
  const [evs, setEvs] = useState<Ev[]>([])
  useEffect(()=>{ fetch('/api/events').then(r=>r.json()).then(d=>setEvs(d.events)) },[])
  return (
    <div className="space-y-2 max-h-[45vh] overflow-auto border border-zinc-800 rounded p-2">
      {evs.map(e => (
        <div key={e.id} className="text-sm">
          <span className="opacity-60 mr-2">{new Date(e.ts).toLocaleString()}</span>
          <b className="mr-2">[{e.kind}]</b>{e.summary}
        </div>
      ))}
    </div>
  )
}
