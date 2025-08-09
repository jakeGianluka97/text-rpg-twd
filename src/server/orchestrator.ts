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
Usa le AZIONI (simili a tools) definite qui sotto. ${TOOL_CATALOG}

REGOLE DI PROGRESSIONE (obbligatorie):
- Ogni turno devi introdurre almeno UN elemento nuovo rispetto al turno precedente (evento DB, dettaglio scena o domanda specifica).
- Le opzioni finali ('- ...') devono cambiare e riferirsi alla situazione aggiornata.
- Usa get_scene_state/set_scene_state per avanzare di fase (es.: 'intro' -> 'parley' -> 'interpreter' -> 'road' -> 'camp').
- Rispondi sempre **SOLO** in JSON valido e **una azione per volta**.
- Quando pronto, chiudi con {"action":"final","parameters":{"reply":"..."}}.
- Non ripetere i JSON o le stesse frasi: variazione obbligatoria.`

  let history: any[] = [
    { role: 'system', content: SYSTEM },
    { role: 'system', content: sysToolPrompt },
    { role: 'user', content: `PG: ${char.name} — input: ${text}` },
    { role: 'system', content: `Suggerimento: prima azione "get_scene_state" con characterId="${char.id}" poi "world_context".` }
  ]

  let finalReply: string | null = null
  let lastReply: string = ''

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: history,
      temperature: step === 0 ? 0.4 : 0.6,
      presence_penalty: 0.6,
      frequency_penalty: 0.5
    })

    let raw = res.choices?.[0]?.message?.content?.trim() || ''
    raw = raw.replace(/^```json\s*|\s*```$/g, '')
    const req = extractJSON(raw) as any || { action: 'final', parameters: { reply: raw || '...' } }

    if (req.action === 'final') {
      let candidate = String(req.parameters?.reply || '...')
      const same = candidate.slice(0, 180) === lastReply.slice(0, 180)
      if (same) {
        history.push({ role: 'system', content: 'La bozza è ripetitiva. Avanza di fase, aggiungi un fatto nuovo e riformula opzioni diverse. Produci di nuovo final.' })
        continue
      }
      lastReply = candidate
      finalReply = candidate
      break
    }

    const result = await execTool(req)
    history.push({ role: 'assistant', content: JSON.stringify(req) })
    history.push({
      role: 'system',
      content: `Osservazione: ${JSON.stringify(result).slice(0, 6000)}\nUsa queste informazioni per proseguire e, se sufficiente, chiudere con azione "final".`
    })
  }

  if (!finalReply) {
    const fin = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      presence_penalty: 0.7,
      frequency_penalty: 0.6,
      messages: [...history, { role: 'system', content: 'Produci azione finale ora, con 2–4 opzioni nuove.' }]
    })
    let raw = fin.choices?.[0]?.message?.content?.trim() || '...'
    raw = raw.replace(/^```json\s*|\s*```$/g, '')
    try { finalReply = JSON.parse(raw)?.reply ?? raw } catch { finalReply = raw }
  }

  const safe = basicLinguisticsEffect(finalReply || '...', char.languages.map(l => l.languageCode))
  await prisma.event.create({ data: { kind: 'scene', summary: `Interazione: ${char.name}`, payload: { text, reply: safe } } })
  return { reply: safe }
}
