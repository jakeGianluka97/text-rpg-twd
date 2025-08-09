'use client'
import useSWR from 'swr'
const f = (u:string)=>fetch(u).then(r=>r.json())

export default function Timeline({ characterId }: { characterId: string | null }) {
  const key = characterId ? `/api/events?characterId=${characterId}` : null
  const { data } = useSWR(key, f, { revalidateOnFocus: false })
  const events = data?.events ?? []
  return (
    <div className="space-y-2 text-sm">
      {events.map((e:any)=>(
        <div key={e.id} className="flex gap-2">
          <span className="text-zinc-400 w-[160px]">{new Date(e.ts).toLocaleString()}</span>
          <span className="font-medium">[{e.kind}]</span>
          <span className="truncate">{e.summary}</span>
        </div>
      ))}
    </div>
  )
}
