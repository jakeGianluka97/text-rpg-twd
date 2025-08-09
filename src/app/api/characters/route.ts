import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { name, motherTongue, known } = await req.json()
  const player = await prisma.player.upsert({
    where: { email: 'demo@twd.local' },
    update: {},
    create: { email: 'demo@twd.local', name: 'Demo', locale: 'it-IT' }
  })
  const ch = await prisma.character.create({ data: {
    playerId: player.id, name, concept: 'WIP', backstory: 'WIP', originLocale: 'it-IT',
    traits: {}, stats: {}, proficiency: {}
  }})
  await prisma.characterLanguage.create({ data: { characterId: ch.id, languageCode: motherTongue, level: 5 } })
  for (const k of (known ?? [])) await prisma.characterLanguage.upsert({
    where: { characterId_languageCode: { characterId: ch.id, languageCode: k } },
    update: { level: 1 },
    create: { characterId: ch.id, languageCode: k, level: 1 }
  })
  return NextResponse.json({ id: ch.id })
}
