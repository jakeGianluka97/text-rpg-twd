import { prisma } from '@/lib/db'

export const tools = {
  async queryEvents(filters: any, limit = 5) {
    return prisma.event.findMany({ where: filters, orderBy: { ts: 'desc' }, take: limit })
  },
  async upsertEvent(data: { kind: string; summary: string; payload?: any; locationId?: string | null; gmAsserted?: boolean }) {
    const ev = await prisma.event.create({ data: { ...data, payload: data.payload ?? {}, gmAsserted: data.gmAsserted ?? true } });
    const { upsertMemoryVector } = await import('./embeddings');
    await upsertMemoryVector({ id: ev.id, scope: 'world', refId: data.locationId || null, content: `${data.kind}: ${data.summary}` });
    return ev
  },
  async getCharacter(id: string) {
    return prisma.character.findUnique({ where: { id }, include: { languages: { include: { language: true } } } })
  },
  async getLanguages() { return prisma.language.findMany() },
}
