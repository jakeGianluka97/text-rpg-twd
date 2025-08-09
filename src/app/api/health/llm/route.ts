import { NextResponse } from 'next/server'
import { getOpenAI, MODEL } from '@/lib/llm'
export async function GET() {
  try {
    const openai = getOpenAI()
    const res = await openai?.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 8
    })
    return NextResponse.json({ ok: true, model: MODEL, sample: res?.choices?.[0]?.message?.content })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
