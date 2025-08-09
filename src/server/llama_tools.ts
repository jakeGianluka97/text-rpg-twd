import { prisma } from '@/lib/db'
import { searchMemory, upsertMemoryVector } from '@/server/embeddings'
import { shortestPath } from '@/server/pathfinding'

export type ToolAction =
  | { action: 'query_events', parameters: { kind?: string, limit?: number } }
  | { action: 'upsert_event', parameters: { kind: string, summary: string, locationId?: string|null } }
  | { action: 'rag_search', parameters: { q: string, limit?: number } }
  | { action: 'pathfind', parameters: { fromId: string, toId: string } }
  | { action: 'world_context', parameters: { } }
  | { action: 'get_scene_state', parameters: { characterId: string } }
  | { action: 'set_scene_state', parameters: { characterId: string, state: any } }
  | { action: 'final', parameters: { reply: string } }

export type ToolResult =
  | { type: 'events', data: any[] }
  | { type: 'event', data: any }
  | { type: 'rag', data: any[] }
  | { type: 'path', data: any }
  | { type: 'world', data: any }
  | { type: 'final', data: { reply: string } }
  | { type: 'error', error: string }

export function extractJSON(text: string): any | null {
  if (!text) return null
  const clean = text.replace(/^```json\s*|\s*```$/g, '').trim()
  try { return JSON.parse(clean) } catch {}
  const m = clean.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return null
}

export async function execTool(req: ToolAction): Promise<ToolResult> {
  try {
    if (req.action === 'query_events') {
      const rows = await prisma.event.findMany({
        where: req.parameters.kind ? { kind: req.parameters.kind } : {},
        orderBy: { ts: 'desc' },
        take: Math.min(50, Math.max(1, req.parameters.limit ?? 5))
      })
      return { type: 'events', data: rows }
    }
    if (req.action === 'upsert_event') {
      const e = await prisma.event.create({ data: {
        kind: req.parameters.kind, summary: req.parameters.summary,
        payload: {}, locationId: req.parameters.locationId ?? null, gmAsserted: true
      }})
      await upsertMemoryVector({ id: e.id, scope: 'world', refId: e.locationId || null, content: `${e.kind}: ${e.summary}` })
      return { type: 'event', data: e }
    }
    if (req.action === 'rag_search') {
      const rows = await searchMemory(req.parameters.q, Math.min(20, Math.max(1, req.parameters.limit ?? 5)))
      return { type: 'rag', data: rows }
    }
    if (req.action === 'pathfind') {
      const p = await shortestPath(req.parameters.fromId, req.parameters.toId)
      return { type: 'path', data: p }
    }
    if (req.action === 'world_context') {
      const locs = await prisma.location.findMany({ take: 20, orderBy: { updatedAt: 'desc' } })
      const recent = await prisma.event.findMany({ orderBy: { ts: 'desc' }, take: 10 })
      return { type: 'world', data: { locations: locs, events: recent } }
    }
    if (req.action === 'get_scene_state') {
      const row = await prisma.sceneState.findUnique({ where: { characterId: req.parameters.characterId } })
      return { type: 'world', data: { scene_state: row?.state ?? null } }
    }
    if (req.action === 'set_scene_state') {
      const rec = await prisma.sceneState.upsert({
        where: { characterId: req.parameters.characterId },
        update: { state: req.parameters.state, updatedAt: new Date() },
        create: { characterId: req.parameters.characterId, state: req.parameters.state }
      })
      return { type: 'world', data: { ok: true, id: rec.characterId } }
    }
    if (req.action === 'final') {
      return { type: 'final', data: { reply: String((req as any).parameters?.reply || '') } }
    }
    return { type: 'error', error: 'unknown_action' }
  } catch (e:any) {
    return { type: 'error', error: String(e) }
  }
}

export const TOOL_CATALOG = `
Puoi scegliere esattamente una tra queste AZIONI (action) per volta e rispondere SEMPRE in JSON valido:
- { "action": "world_context", "parameters": {} }  -> ti restituisce luoghi e ultimi eventi
- { "action": "query_events", "parameters": { "kind": "scene", "limit": 5 } }
- { "action": "rag_search", "parameters": { "q": "string", "limit": 5 } }
- { "action": "pathfind", "parameters": { "fromId": "id", "toId": "id" } }
- { "action": "upsert_event", "parameters": { "kind": "string", "summary": "string" } }
- { "action": "get_scene_state", "parameters": { "characterId": "id_pg" } }
- { "action": "set_scene_state", "parameters": { "characterId": "id_pg", "state": { "phase":"parley" } } }
- { "action": "final", "parameters": { "reply": "testo al giocatore con 2–4 opzioni '- ' } }

Regole:
- Scegli una sola action per volta.
- Quando hai abbastanza informazioni, usa "final" con il testo scenico e opzioni nuove.
- Mantieni coerenza spazio/tempo con i dati ricevuti.
`
