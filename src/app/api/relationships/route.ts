import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const characterId = searchParams.get('characterId') || ''
  const rels = await prisma.relationship.findMany({ where: { subjectType: 'character', subjectId: characterId } })
  return NextResponse.json({ rels })
}
