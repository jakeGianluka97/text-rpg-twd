'use client'
import useSWR from 'swr'
const f = (u: string) => fetch(u).then(r => r.json())

export default function Timeline({ characterId }: { characterId: string | null }) {
  const key = characterId ? `/api/events?characterId=${characterId}` : null
  const { data } = useSWR(key, f, { revalidateOnFocus: false })
  const events = data?.events ?? []
  return (
    <div className="space-y-2 max-h-[45vh] overflow-auto border border-zinc-800 rounded p-2">
      {events.map((e: any) => (
        <div key={e.id} className="text-sm">
          <span className="opacity-60 mr-2">{new Date(e.ts).toLocaleString()}</span>
          <b className="mr-2">[{e.kind}]</b>{e.summary}
        </div>
      ))}
    </div>
  )
}
