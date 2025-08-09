// src/app/api/scene-state/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get('characterId')!
  const row = await prisma.sceneState.findUnique({ where: { characterId: id } })
  return NextResponse.json({ state: row?.state ?? null })
}
