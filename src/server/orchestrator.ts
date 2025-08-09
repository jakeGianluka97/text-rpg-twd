import { getOpenAI, MODEL } from '@/lib/llm'
import { SYSTEM_PROMPT } from '@/server/policies'
import { TOOL_CATALOG, extractJSON, execTool } from '@/server/llama_tools'
import { prisma } from '@/lib/db'

const SYSTEM = SYSTEM_PROMPT
const MAX_STEPS = 6

function basicLinguisticsEffect(text: string, knownCodes: string[]) {
  if (!knownCodes.includes('nap') && /napoletano|nap\b/i.test(text)) {
    return 'Capisci a metà: ' + text.replace(/[aeiou]/gi, '')
  }
  return text
}

export async function handlePlayerMessage({ characterId, text }: { characterId: string; text: string }) {
  const char = await prisma.character.findUnique({ where: { id: characterId }, include: { languages: { include: { language: true } } } })
  if (!char) return { reply: 'Personaggio non trovato.' }

  const openai = getOpenAI()
  if (!openai) {
    const reply = `Hai detto: "${text}". Una voce in dialetto napoletano risponde da lontano.
- Chiedere di trattare
- Cercare un interprete
- Offrire qualcosa in cambio
- Andartene in silenzio`
    await prisma.event.create({ data: { kind: 'scene', summary: `Interazione: ${char.name} (stub)`, payload: { text } } })
    return { reply: basicLinguisticsEffect(reply, char.languages.map(l => l.languageCode)) }
  }

const sysToolPrompt = `Sei un Game Master AI per The Walking Dead.
Usa le AZIONI fornite (una per volta) e rispondi sempre SOLO in JSON valido.
REGOLE DI PROGRESSIONE:
- Ogni turno devi introdurre almeno UN elemento nuovo (evento DB, dettaglio scena, domanda specifica) rispetto al turno precedente.
- Le opzioni finali ('- ...') devono cambiare e riferirsi alla situazione aggiornata.
- Usa get_scene_state/set_scene_state per avanzare di fase (es. 'intro' -> 'parley' -> 'interpreter' -> 'road' -> 'camp').
- Quando pronto, chiudi con {"action":"final","parameters":{"reply":"...con 2–4 opzioni"}}. Niente markdown fuori dal JSON.`

  let history: any[] = [
    { role: 'system', content: SYSTEM },
    { role: 'system', content: sysToolPrompt },
    { role: 'user', content: `PG: ${char.name} — input: ${text}` }
  ]

  let finalReply: string | null = null

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: history,
      temperature: step === 0 ? 0.4 : 0.6,
    })

    let raw = res.choices?.[0]?.message?.content?.trim() || ''
    raw = raw.replace(/^```json\s*|\s*```$/g, '')
    const req = extractJSON(raw) as any || { action: 'final', parameters: { reply: raw || '...' } }

    // if model already provides final, stop
    if (req.action === 'final') {
      finalReply = String(req.parameters?.reply || '...')
      break
    }

    // Execute tool and append observation
    const result = await execTool(req)
    // Push what the assistant "requested"
    history.push({ role: 'assistant', content: JSON.stringify(req) })
    // Provide the result back as observation and instruct to continue or finalize
    const guide = (result as any)?.type === 'world' || (result as any)?.type === 'events' ?
      'Usa queste informazioni per proseguire verso una risposta finale.' :
      'Ora, se sufficiente, produci azione finale con narrativa.'

    history.push({
      role: 'system',
      content: `Osservazione: ${JSON.stringify(result).slice(0, 6000)}\n${guide}`
    })
  }

  if (!finalReply) {
    // ask the model to finalize no matter what
    const fin = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      messages: [...history, { role: 'system', content: 'Produci azione finale ora.' }]
    })
    let raw = fin.choices?.[0]?.message?.content?.trim() || '...'
    raw = raw.replace(/^```json\s*|\s*```$/g, '')
    try { finalReply = JSON.parse(raw)?.reply ?? raw } catch { finalReply = raw }
  }

  const safe = basicLinguisticsEffect(finalReply || '...', char.languages.map(l => l.languageCode))
  await prisma.event.create({ data: { kind: 'scene', summary: `Interazione: ${char.name}`, payload: { text, reply: safe } } })

  // opzionale: debug interno (non mostrare JSON all'utente)
  if (process.env.GM_DEBUG === '1') {
    await prisma.event.create({ data: { kind: 'gm_debug', summary: 'planner trace', payload: { historyLen: history.length } } })
  }

  return { reply: safe }
}
