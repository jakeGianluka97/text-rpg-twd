import { getOpenAI, MODEL } from '@/lib/llm'
import { SYSTEM_PROMPT } from '@/server/policies'
import { TOOL_CATALOG, extractJSON, execTool } from '@/server/llama_tools'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

const SYSTEM = SYSTEM_PROMPT
const MAX_STEPS = 6

type StepTrace = { action: string; note?: string }
type SceneStateDoc = {
  phase?: string
  location?: { lat: number; lon: number; name?: string } | null
  [k: string]: unknown
}

function asSceneStateDoc(v: Prisma.JsonValue | null | undefined): SceneStateDoc | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as SceneStateDoc
  return null
}

const CANON = /\b(rick|grimes|daryl|dix(on)?|michonne|negan|carol|glenn|maggie|shane|lori)\b/i
function violatesCanon(s: string) { return CANON.test(s) }

// rozzo ma efficace per beccare inglese: molte parole con 'the/and/is/are' e niente accenti
const EN_HINT = /\b(the|and|is|are|you|your|they|their|we|our)\b/i
function looksEnglish(s: string) { return EN_HINT.test(s) }

function basicLinguisticsEffect(text: string, knownCodes: string[]) {
  if (!knownCodes.includes('nap') && /napoletano|nap\b/i.test(text)) {
    return 'Capisci a metà: ' + text.replace(/[aeiou]/gi, '')
  }
  return text
}
function stripFenceJson(s: string) { return s.replace(/^```json\s*|\s*```$/g, '').trim() }
function extractOptions(txt: string): string[] {
  const out: string[] = []
  const re = /^-\s+(.+)$/gm
  let m
  while ((m = re.exec(txt)) !== null) out.push(m[1].trim())
  return out.slice(0, 6)
}

export async function handlePlayerMessage({
  characterId, text,
}: { characterId: string; text: string }) {

  const char = await prisma.character.findUnique({
    where: { id: characterId },
    include: { languages: { include: { language: true } } },
  })
  if (!char) return { reply: 'Personaggio non trovato.', options: [], trace: [], location: null }

  const openai = getOpenAI()

  // === STUB senza LLM ===
  if (!openai) {
    const reply = `Hai detto: "${text}". Una voce in dialetto napoletano risponde da lontano.
- Chiedere di trattare
- Cercare un interprete
- Offrire qualcosa in cambio
- Andartene in silenzio`
    await prisma.event.create({
      data: { kind: 'scene', summary: `Interazione: ${char.name} (stub)`, payload: { text }, characterId: char.id },
    })
    const safe = basicLinguisticsEffect(reply, char.languages.map(l => l.languageCode))
    const options = extractOptions(safe)
    const row = await prisma.sceneState.findUnique({ where: { characterId: char.id } })
    const doc = asSceneStateDoc(row?.state)
    const location = doc?.location ?? null
    return { reply: safe, options, trace: [], location }
  }

  const sysToolPrompt = `Sei un Game Master AI per The Walking Dead (solo universo, niente personaggi canon).
Regole assolute:
- Rispondi SEMPRE in italiano chiaro.
- PNG e gruppi DEVONO essere originali (vietati nomi canon: Rick, Daryl, Michonne, Negan, ecc.).
- Usa AZIONI (tipo tools) definite qui sotto. ${TOOL_CATALOG}
- Ogni turno aggiungi almeno un fatto nuovo e proponi 2–4 opzioni in elenco "- ...".
- Usa get_scene_state/set_scene_state per avanzare la fase (intro -> parley -> road -> camp ecc.).
- Produce una sola azione per volta e chiudi con {"action":"final","parameters":{"reply":"..."}}.`

  const history: any[] = [
    { role: 'system', content: SYSTEM },
    { role: 'system', content: sysToolPrompt },
    { role: 'system', content: 'Lingua obbligatoria: ITALIANO. Personaggi canon VIETATI.' },
    { role: 'user', content: `PG: ${char.name} — input: ${text}` },
    { role: 'system', content: `Suggerimento: prima "get_scene_state" characterId="${char.id}", poi "world_context".` },
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
        history.push({ role: 'system', content: 'La bozza è ripetitiva. Avanza la storia, opzioni diverse. Ripeti final.' })
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
      content: `Osservazione: ${JSON.stringify(result).slice(0, 6000)}\nProsegui e chiudi con "final" quando pronto.`,
    })
  }

  if (!finalReply) {
    const fin = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      presence_penalty: 0.7,
      frequency_penalty: 0.6,
      messages: [...history, { role: 'system', content: 'Chiudi con azione "final" ora, 2–4 opzioni nuove.' }],
    })
    let raw = stripFenceJson(fin.choices?.[0]?.message?.content || '...')
    try { finalReply = JSON.parse(raw)?.reply ?? raw } catch { finalReply = raw }
  }

  // Post-processing: mai canon, sempre italiano
  let safe = basicLinguisticsEffect(finalReply || '...', char.languages.map(l => l.languageCode))
  if (violatesCanon(safe) || looksEnglish(safe)) {
    const regen = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [
        ...history,
        { role: 'system', content: 'Riformula la risposta in ITALIANO con PNG originali (vietati nomi canon).' },
        { role: 'assistant', content: JSON.stringify({ action: 'final', parameters: { reply: safe } }) },
      ],
    })
    const rr = stripFenceJson(regen.choices?.[0]?.message?.content || '')
    try { safe = JSON.parse(rr)?.reply ?? rr } catch { safe = rr }
  }

  // Event legato al PG
  await prisma.event.create({
    data: {
      kind: 'scene',
      summary: `Interazione: ${char.name}`,
      payload: { text, reply: safe },
      characterId: char.id,
    },
  })

  // Posizione corrente
  const row = await prisma.sceneState.findUnique({ where: { characterId: char.id } })
  const doc = asSceneStateDoc(row?.state)
  const location = doc?.location ?? null

  const options = extractOptions(safe)
  return { reply: safe, options, trace, location }
}
