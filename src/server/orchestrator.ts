import { getOpenAI, MODEL } from '@/lib/llm'
import { SYSTEM_PROMPT } from '@/server/policies'
import { TOOL_CATALOG, extractJSON, execTool } from '@/server/llama_tools'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

const SYSTEM = SYSTEM_PROMPT
const MAX_STEPS = 6

type SceneStateDoc = { phase?: string; location?: { lat:number; lon:number; name?:string } | null; [k:string]:unknown }
function asScene(v: Prisma.JsonValue | null | undefined): SceneStateDoc | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as SceneStateDoc) : null
}
const CANON = /\b(rick|grimes|daryl|dix(on)?|michonne|negan|carol|glenn|maggie|shane|lori)\b/i
const EN = /\b(the|and|is|are|you|your|they|their|we|our)\b/i
const looksEnglish = (s:string)=>EN.test(s)
const violatesCanon = (s:string)=>CANON.test(s)

function basicLinguisticsEffect(text: string, knownCodes: string[]) {
  if (!knownCodes.includes('nap') && /napoletano|nap\b/i.test(text)) return 'Capisci a metà: ' + text.replace(/[aeiou]/gi, '')
  return text
}
const strip = (s:string)=>s.replace(/^```json\s*|\s*```$/g,'').trim()
const opts = (t:string)=>{ const a=[] as string[]; const r=/^-\s+(.+)$/gm; let m; while((m=r.exec(t))!==null)a.push(m[1].trim()); return a.slice(0,6) }

export async function handlePlayerMessage({ characterId, text }: { characterId: string; text: string }) {
  const char = await prisma.character.findUnique({ where: { id: characterId }, include: { languages: { include: { language: true } } } })
  if (!char) return { reply: 'Personaggio non trovato.', options: [], trace: [], location: null }

  const openai = getOpenAI()
  if (!openai) {
    const reply = `Hai detto: "${text}". Una voce in dialetto napoletano risponde da lontano.
- Chiedere di trattare
- Cercare un interprete
- Offrire qualcosa in cambio
- Andartene in silenzio`
    await prisma.event.create({ data: { kind: 'scene', summary: `Interazione: ${char.name} (stub)`, payload: { text }, characterId: char.id } })
    const safe = basicLinguisticsEffect(reply, char.languages.map(l=>l.languageCode))
    const row = await prisma.sceneState.findUnique({ where: { characterId: char.id } })
    const doc = asScene(row?.state)
    return { reply: safe, options: opts(safe), trace: [], location: doc?.location ?? null }
  }

  const sysTool = `Sei un Game Master AI per The Walking Dead (solo universo, niente personaggi canon).
- Rispondi SEMPRE in italiano.
- PNG e gruppi DEVONO essere originali (vietati nomi canon).
- Usa AZIONI (tipo tools) definite qui sotto. ${TOOL_CATALOG}
- Ogni turno aggiungi almeno un fatto nuovo e proponi 2–4 opzioni in elenco "- ...".
- Usa get_scene_state/set_scene_state per avanzare fase. Produci UNA azione per volta e chiudi con {"action":"final","parameters":{"reply":"..."}}.`

  const history:any[] = [
    { role:'system', content: SYSTEM },
    { role:'system', content: sysTool },
    { role:'system', content: 'Lingua obbligatoria: ITALIANO. Personaggi canon VIETATI.' },
    { role:'user', content: `PG: ${char.name} — input: ${text}` },
    { role:'system', content: `Suggerimento: prima "get_scene_state" characterId="${char.id}", poi "world_context".` },
  ]

  let finalReply:string|null=null
  for (let i=0;i<MAX_STEPS;i++){
    const res = await openai.chat.completions.create({ model: MODEL, messages: history, temperature: i===0?0.4:0.6, presence_penalty:0.6, frequency_penalty:0.5 })
    let raw = strip(res.choices?.[0]?.message?.content||'')
    const req = (extractJSON(raw) as any) || { action:'final', parameters:{ reply:raw || '...' } }
    if (req.action==='final'){ finalReply=String(req.parameters?.reply || '...'); break }
    const out = await execTool(req)
    history.push({ role:'assistant', content: JSON.stringify(req) })
    history.push({ role:'system', content: `Osservazione: ${JSON.stringify(out).slice(0,6000)}\nProsegui e chiudi con "final" quando pronto.` })
  }
  if(!finalReply){
    const fin = await openai.chat.completions.create({ model: MODEL, temperature:0.7, messages:[...history, { role:'system', content:'Chiudi con azione "final" (2–4 opzioni).' }] })
    const raw = strip(fin.choices?.[0]?.message?.content||'...')
    try { finalReply = JSON.parse(raw)?.reply ?? raw } catch { finalReply = raw }
  }

  let safe = basicLinguisticsEffect(finalReply||'...', char.languages.map(l=>l.languageCode))
  if (violatesCanon(safe) || looksEnglish(safe)){
    const regen = await openai.chat.completions.create({
      model: MODEL, temperature:0.6,
      messages:[...history, { role:'system', content:'Riformula la risposta in ITALIANO con PNG originali (vietati nomi canon).' }, { role:'assistant', content: JSON.stringify({ action:'final', parameters:{ reply:safe }}) }]
    })
    const rr = strip(regen.choices?.[0]?.message?.content||'')
    try { safe = JSON.parse(rr)?.reply ?? rr } catch { safe = rr }
  }

  await prisma.event.create({ data: { kind:'scene', summary:`Interazione: ${char.name}`, payload:{ text, reply:safe }, characterId: char.id } })

  // Location dal SceneState + fallback Napoli
  const row = await prisma.sceneState.findUnique({ where: { characterId: char.id } })
  let doc = asScene(row?.state) ?? { phase:'intro', location:null }
  let location = doc.location ?? null
  const has = location && typeof location.lat==='number' && typeof location.lon==='number'
  if (!has){
    location = { lat: 40.8518, lon: 14.2681, name: 'Napoli — Centro' }
    doc = { ...doc, location }
    await prisma.sceneState.upsert({ where: { characterId: char.id }, update: { state: doc as any }, create: { characterId: char.id, state: doc as any } })
  }

  return { reply: safe, options: opts(safe), trace: [], location }
}
