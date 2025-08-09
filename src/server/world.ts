import cron from 'node-cron'
import { prisma } from '@/lib/db'

const g = global as any
if (!g.__WORLD_TICK_STARTED__) {
  g.__WORLD_TICK_STARTED__ = true
  cron.schedule('*/2 * * * *', async () => {
    const locs = await prisma.location.findMany({ take: 1, orderBy: { updatedAt: 'asc' } }).catch(()=>[] as any)
    if (!locs || !locs.length) return
    const loc = locs[0]
    const newDanger = Math.max(0, Math.min(7, (loc.dangerLevel ?? 0) + (Math.random() > 0.5 ? 1 : -1)))
    await prisma.location.update({ where: { id: loc.id }, data: { dangerLevel: newDanger, lastState: { ...(loc.lastState as any || {}), tick: Date.now() } } })
    await prisma.event.create({ data: { kind: 'world_tick', summary: `Pericolo aggiornato a ${newDanger} in ${loc.name}`, payload: { locationId: loc.id } } })
    console.log('[world_tick]', loc.name, '->', newDanger)
  })
  console.log('[world] scheduler started')
}
