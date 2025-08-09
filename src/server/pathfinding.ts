import { prisma } from '@/lib/db'
type Edge = { to: string; travelMin: number; risk: number }
type Graph = Record<string, Edge[]>

export async function buildGraph() {
  const wps = await prisma.waypoint.findMany()
  const g: Graph = {}
  for (const w of wps) {
    g[w.fromId] = g[w.fromId] || []
    g[w.fromId].push({ to: w.toId, travelMin: w.travelMin, risk: w.risk })
  }
  return g
}

export async function shortestPath(fromId: string, toId: string) {
  const g = await buildGraph()
  const nodes = new Set(Object.keys(g))
  if (!nodes.has(fromId)) nodes.add(fromId)
  if (!nodes.has(toId)) nodes.add(toId)
  const dist: Record<string, number> = {}; const prev: Record<string, string|null> = {}
  nodes.forEach(k => { dist[k] = Infinity; prev[k] = null })
  dist[fromId] = 0
  while (nodes.size) {
    let u: string|null = null, best = Infinity
    for (const k of nodes) if (dist[k] < best) best = dist[k], u = k
    if (u === null) break
    nodes.delete(u)
    if (u === toId) break
    const edges = g[u] || []
    for (const e of edges) {
      const alt = dist[u] + e.travelMin + e.risk
      if (alt < (dist[e.to] ?? Infinity)) { dist[e.to] = alt; prev[e.to] = u }
    }
  }
  const path: string[] = []
  let cur: string|null = toId
  while (cur) { path.unshift(cur); cur = prev[cur] }
  return { cost: dist[toId], path }
}
