import '@/server/world'
import { NextRequest, NextResponse } from 'next/server'
import { handlePlayerMessage } from '@/server/orchestrator'

export async function POST(req: NextRequest) {
  const { characterId, text } = await req.json()
  const result = await handlePlayerMessage({ characterId, text })
  return NextResponse.json(result)
}
