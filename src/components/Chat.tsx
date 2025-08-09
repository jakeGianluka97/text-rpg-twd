'use client'
import { useRef, useState } from 'react'
import { mutate } from 'swr'

type Msg = { sender: 'player' | 'gm'; text: string; options?: string[] }
type GMResult = {
  reply: string
  options?: string[]
  trace?: Array<{ action: string; note?: string }>
  location?: { lat: number; lon: number; name?: string } | null
}

export default function Chat({
  characterId,
  onLocationChange,   // (punto 3) callback per aggiornare il marker in mappa
  showTrace = false,  // se vuoi vedere il log del planner
}: {
  characterId: string | null
  onLocationChange?: (loc: GMResult['location']) => void
  showTrace?: boolean
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [trace, setTrace] = useState<NonNullable<GMResult['trace']>>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function send(textFromButton?: string) {
    if (!characterId) return alert('Crea/seleziona un personaggio prima.')
    const text = (textFromButton ?? inputRef.current?.value ?? '').trim()
    if (!text) return

    // render messaggio utente
    setMessages((m) => [...m, { sender: 'player', text }])
    if (!textFromButton && inputRef.current) inputRef.current.value = ''

    // call GM
    const res = await fetch('/api/gm/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, text }),
    })

    let payload: GMResult | null = null
    if (res.ok) {
      try {
        payload = (await res.json()) as GMResult
      } catch {
        const t = await res.text()
        payload = { reply: `Errore di parsing risposta GM. ${t.slice(0, 200)}` }
      }
    } else {
      const t = await res.text()
      payload = { reply: `GM error ${res.status}. ${t.slice(0, 200)}` }
    }

    // mostra SOLO la narrativa + opzioni
    const reply = payload?.reply ?? 'Errore: nessuna risposta dal GM.'
    const options = payload?.options ?? []
    setMessages((m) => [...m, { sender: 'gm', text: reply, options }])

    // (2D) aggiorna la timeline del PG
    mutate(`/api/events?characterId=${characterId}`)

    // (3) notifica la posizione corrente (per il marker in mappa)
    if (onLocationChange) onLocationChange(payload?.location ?? null)

    // opzionale: log del planner
    setTrace(payload?.trace ?? [])
  }

  return (
    <div className="flex flex-col h-[70vh] border border-zinc-800 rounded">
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.sender === 'gm' ? 'text-emerald-300' : 'text-zinc-200'}>
            <span className="opacity-60 mr-2">{m.sender === 'gm' ? 'GM' : 'Tu'}:</span>
            <span className="whitespace-pre-wrap">{m.text}</span>

            {/* Opzioni come chip cliccabili */}
            {!!m.options?.length && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className="px-3 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-sm"
                    onClick={() => send(opt)}
                    title="Invia come azione"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Pannello log (collassabile) */}
        {showTrace && trace.length > 0 && (
          <details className="text-xs text-zinc-400">
            <summary className="cursor-pointer">Log del GM</summary>
            <ul className="pl-4 list-disc">
              {trace.map((s, i) => (
                <li key={i}>
                  {s.action}
                  {s.note ? ` → ${s.note}` : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="p-2 flex gap-2 border-t border-zinc-800">
        <input
          ref={inputRef}
          className="flex-1 bg-zinc-800 p-2 rounded"
          placeholder="Scrivi un'azione o un messaggio..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') send()
          }}
        />
        <button className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded" onClick={() => send()}>
          Invia
        </button>
      </div>
    </div>
  )
}
