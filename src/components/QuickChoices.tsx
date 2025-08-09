'use client'
export default function QuickChoices({ last, onPick }: { last?: string, onPick: (t:string)=>void }) {
  if (!last) return null
  const choices = (last.split('\n').filter(l => l.trim().startsWith('- ')).map(l => l.trim().slice(2))).slice(0, 4)
  if (choices.length === 0) return null
  return (
    <div className="px-2 py-2 flex flex-wrap gap-2">
      {choices.map((c,i)=>(
        <button key={i} className="text-sm px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
                onClick={()=>onPick(c)}>{c}</button>
      ))}
    </div>
  )
}
