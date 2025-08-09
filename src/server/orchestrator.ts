import { getOpenAI, MODEL } from '@/lib/llm'
import { SYSTEM_PROMPT } from '@/server/policies'
import { TOOL_CATALOG, extractJSON, execTool } from '@/server/llama_tools'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'   // <-- NEW (per i tipi Json)

const SYSTEM = SYSTEM_PROMPT
const MAX_STEPS = 6

type StepTrace = { action: string; note?: string }

/** Struttura che vogliamo nel campo SceneState.state (Json) */
type SceneStateDoc = {
  phase?: string
  location?: { lat: number; lon: number; name?: string } | null
  [k: string]: unknown
}

function asSceneStateDoc(v: Prisma.JsonValue | null | undefined): SceneStateDoc | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as SceneStateDoc
  return null
}

function violatesCanon(s: string) {
  return /\b(rick|grimes|daryl|michonne|negan|carol|glenn)\b/i.test(s)
}

function basicLinguisticsEffect(text: string, knownCodes: string[]) {
  if (!knownCodes.includes('nap') && /napoletano|nap\b/i.test(text)) {
    return 'Capisci a metà: ' + text.replace(/[aeiou]/gi, '')
  }
  return text
}

function stripFenceJson(s: string) {
  return s.replace(/^```json\s*|\s*```$/g, '').trim()
}

function extractOptions(txt: string): string[] {
  const out: string[] = []
  const re = /^-\s+(.+)$/gm
  let m
  while ((m = re.exec(txt)) !== null) out.push(m[1].trim())
  return out.slice(0, 6)
}

export async function handlePlayerMessage({
  characterId,
  text,
}: {
  characterId: string
  text: string
}) {
  const char = await prisma.character.findUnique({
    where: { id: characterId },
    include: { languages: { include: { language: true } } },
  })
  if (!char) return { reply: 'Personaggio non trovato.', options: [], trace: [], location: null }

  const openai = getOpenAI()

  // === Fallback senza LLM ===
  if (!openai) {
    const reply = `Hai detto: "${text}". Una voce in dialetto napoletano risponde da lontano.
- Chiedere di trattare
- Cercare un interprete
- Offrire qualcosa in cambio
- Andartene in silenzio`
    await prisma.event.create({
      data: { kind: 'scene', summary: `Interazione: ${char.name} (stub)`, payload: { text } },
    })
    const safe = basicLinguisticsEffect(reply, char.languages.map((l) => l.languageCode))
    const options = extractOptions(safe)
    // posizione PG dal SceneState (cast sicuro)
    const row = await prisma.sceneState.findUnique({ where: { characterId: char.id } })
    const doc = asSceneStateDoc(row?.state)
    const location = doc?.location ?? null
    return { reply: safe, options, trace: [], location }
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

  const history: any[] = [
    { role: 'system', content: SYSTEM },
    { role: 'system', content: sysToolPrompt },
    { role: 'user', content: `PG: ${char.name} — input: ${text}` },
    {
      role: 'system',
      content: `Suggerimento: prima azione "get_scene_state" con characterId="${char.id}" poi "world_context".`,
    },
  ]

  const trace: StepTrace[] = []
  let finalReply: string | null = null
  let lastReply = ''

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await openai.chat.completions.create({
      model: MODEL,
      messages: history,
      temperature: step === 0 ? 0.4 : 0.6,
      presence_penalty: 0.6,
      frequency_penalty: 0.5,
    })

    let raw = stripFenceJson(res.choices?.[0]?.message?.content || '')
    const req = (extractJSON(raw) as any) || { action: 'final', parameters: { reply: raw || '...' } }

    if (req.action === 'final') {
      const candidate = String(req.parameters?.reply || '...')
      const same = candidate.slice(0, 180) === lastReply.slice(0, 180)
      if (same) {
        history.push({
          role: 'system',
          content:
            'La bozza è ripetitiva. Avanza di fase, aggiungi un fatto nuovo e riformula opzioni diverse. Produci di nuovo final.',
        })
        continue
      }
      lastReply = candidate
      finalReply = candidate
      break
    }

    const result = await execTool(req)
    trace.push({ action: req.action, note: (result as any)?.type })
    history.push({ role: 'assistant', content: JSON.stringify(req) })
    history.push({
      role: 'system',
      content: `Osservazione: ${JSON.stringify(result).slice(
        0,
        6000,
      )}\nUsa queste informazioni per proseguire e, se sufficiente, chiudere con azione "final".`,
    })
  }

  if (!finalReply) {
    const fin = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      presence_penalty: 0.7,
      frequency_penalty: 0.6,
      messages: [...history, { role: 'system', content: 'Produci azione finale ora, con 2–4 opzioni nuove.' }],
    })
    let raw = stripFenceJson(fin.choices?.[0]?.message?.content || '...')
    try {
      finalReply = JSON.parse(raw)?.reply ?? raw
    } catch {
      finalReply = raw
    }
  }

  
  const safe = basicLinguisticsEffect(finalReply || '...', char.languages.map((l) => l.languageCode))
if (violatesCanon(safe)) {
  // rigenera una sola volta, più breve e senza canon
  const regen = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.7,
    messages: [
      ...history,
      { role: 'system', content: 'Riformula la risposta in italiano con PNG originali. Vietati nomi canon.' },
      { role: 'assistant', content: JSON.stringify({ action: 'final', parameters: { reply: safe } }) },
    ],
  })
  const rr = (regen.choices?.[0]?.message?.content || '').replace(/^```json\s*|\s*```$/g, '')
  try { finalReply = JSON.parse(rr)?.reply ?? rr } catch { finalReply = rr }
}
await prisma.event.create({
  data: {
    kind: 'scene',
    summary: `Interazione: ${char.name}`,
    payload: { text, reply: safe },
    characterId: char.id,        // <— importante
  },
})
  // posizione PG dal SceneState (cast sicuro)
  const row = await prisma.sceneState.findUnique({ where: { characterId: char.id } })
  const doc = asSceneStateDoc(row?.state)
  const location = doc?.location ?? null

  const options = extractOptions(safe)
  return { reply: safe, options, trace, location }
}
