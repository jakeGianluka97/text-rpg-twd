import { NextRequest, NextResponse } from 'next/server'
import { searchMemory } from '@/server/embeddings'

export async function POST(req: NextRequest) {
  const { q } = await req.json()
  const rows = await searchMemory(q, 5)
  return NextResponse.json({ rows })
}
