import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  return NextResponse.json({ ok: true, only: 'POST to create/update' })
}

export async function POST(req: Request) {
  try {
    const { name, motherTongue, known } = await req.json() as {
      name: string; motherTongue?: string; known?: string[]
    }
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })

    // assicurati che le lingue esistano
    const codes = Array.from(new Set([motherTongue, ...(known ?? [])])).filter(Boolean) as string[]
    await Promise.all(codes.map(code =>
      prisma.language.upsert({
        where: { code },
        update: {},
        create: { code, name: code, type: code === 'nap' ? 'dialect' : 'language' }
      })
    ))

    // player demo
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

    if (motherTongue) {
      await prisma.characterLanguage.upsert({
        where: { characterId_languageCode: { characterId: char.id, languageCode: motherTongue } },
        update: { level: 5 },
        create: { characterId: char.id, languageCode: motherTongue, level: 5 }
      })
    }
    if (known?.length) {
      await prisma.$transaction(known.map(code =>
        prisma.characterLanguage.upsert({
          where: { characterId_languageCode: { characterId: char.id, languageCode: code } },
          update: { level: 3 },
          create: { characterId: char.id, languageCode: code, level: 3 }
        })
      ))
    }

    await prisma.sceneState.upsert({
      where: { characterId: char.id },
      update: {},
      create: { characterId: char.id, state: { phase: 'intro', notes: 'spawn Napoli' } }
    })

    return NextResponse.json({ id: char.id })
  } catch (e:any) {
    console.error('character upsert error', e)
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 })
  }
}
