import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const characterId = searchParams.get('characterId') ?? undefined
  const events = await prisma.event.findMany({
    where: characterId ? { characterId } : {},
    orderBy: { ts: 'desc' },
    take: 50,
    select: { id: true, ts: true, kind: true, summary: true },
  })
  return NextResponse.json({ events })
}
