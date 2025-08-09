import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const { name, motherTongue, known } = await req.json() as {
      name: string; motherTongue: string; known: string[]
    }
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

    // assicurati che le lingue esistano
    const codes = Array.from(new Set([motherTongue, ...(known ?? [])])).filter(Boolean)
    await Promise.all(codes.map(code =>
      prisma.language.upsert({
        where: { code },
        update: {},
        create: { code, name: code, type: code === 'nap' ? 'dialect' : 'language' }
      })
    ))

    // crea/aggiorna il PG (qui uso un player fittizio se non gestisci auth)
    const player = await prisma.player.upsert({
      where: { email: 'demo@twd.local' },
      update: {},
      create: { email: 'demo@twd.local', name: 'Demo', locale: 'it-IT' }
    })

    const char = await prisma.character.create({
      data: {
        name,
        playerId: player.id,
        concept: '',
        backstory: '',
        originLocale: motherTongue || 'it',
        traits: {},
        stats: {},
        proficiency: {}
      }
    })

    // collega le lingue (madre: livello 5, note: livello 3)
    await prisma.characterLanguage.createMany({
      data: [
        ...(motherTongue ? [{ characterId: char.id, languageCode: motherTongue, level: 5 }] : []),
        ...((known ?? []).map(code => ({ characterId: char.id, languageCode: code, level: 3 })))
      ],
      skipDuplicates: true
    })

    // inizializza SceneState se non c'è
    await prisma.sceneState.upsert({
      where: { characterId: char.id },
      update: {},
      create: { characterId: char.id, state: { phase: 'intro', notes: 'spawn iniziale Napoli' } }
    })

    return NextResponse.json({ id: char.id }, { status: 200 })
  } catch (e: any) {
    console.error('character upsert error', e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
