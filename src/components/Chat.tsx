'use client'
import { useRef, useState } from 'react'
import QuickChoices from './QuickChoices'

export default function Chat({ characterId }: { characterId: string | null }) {
  const [messages, setMessages] = useState<{sender:'player'|'gm', text:string}[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const send = async () => {
    if (!characterId) return alert('Crea/seleziona un personaggio prima.');
    const text = inputRef.current?.value?.trim(); if (!text) return;
    setMessages(m => [...m, { sender: 'player', text }])
    inputRef.current!.value = ''
    const res = await fetch('/api/gm/message', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId, text })
    })

    let reply = 'Errore: GM non disponibile.'
    if (res.ok) {
      try {
        const data = await res.json()
        reply = data?.reply ?? reply
      } catch {
        const txt = await res.text()
        reply = `Errore di parsing risposta GM. ${txt?.slice(0,200)}`
      }
    } else {
      const txt = await res.text()
      reply = `GM error ${res.status}. ${txt?.slice(0,200)}`
    }
    setMessages(m => [...m, { sender: 'gm', text: reply }])
  }

  return (
    <div className="flex flex-col h-[70vh] border border-zinc-800 rounded">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {messages.map((m, i) => (
          <div key={i} className={m.sender==='gm'? 'text-emerald-300' : 'text-zinc-200'}>
            <span className="opacity-60 mr-2">{m.sender==='gm'?'GM':'Tu'}:</span>{m.text}
          </div>
        ))}
      </div>
      <QuickChoices last={messages[messages.length-1]?.text} onPick={(t)=>{ if(inputRef.current){ inputRef.current.value=t; send(); } }} />
      <div className="p-2 flex gap-2 border-t border-zinc-800">
        <input ref={inputRef} className="flex-1 bg-zinc-800 p-2 rounded" placeholder="Scrivi un'azione o un messaggio..." />
        <button className="px-3 py-2 bg-emerald-600 rounded" onClick={send}>Invia</button>
      </div>
    </div>
  )}
