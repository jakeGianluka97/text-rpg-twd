import { NextRequest, NextResponse } from 'next/server'
import { shortestPath } from '@/server/pathfinding'
export async function POST(req: NextRequest) {
  const { fromId, toId } = await req.json()
  const result = await shortestPath(fromId, toId)
  return NextResponse.json(result)
}
