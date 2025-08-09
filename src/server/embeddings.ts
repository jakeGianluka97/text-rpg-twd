import { getOpenAI } from '@/lib/llm'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function upsertMemoryVector({ id, scope, refId, content }: { id: string; scope: string; refId?: string|null; content: string }) {
  const openai = getOpenAI()
  if (!openai) return
  const emb = await openai.embeddings.create({ model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large', input: content })
  const vec = emb.data[0].embedding
  const client = await pool.connect()
  try {
    await client.query(
      `INSERT INTO memory_vectors (id, scope, ref_id, content, embedding) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET scope=EXCLUDED.scope, ref_id=EXCLUDED.ref_id, content=EXCLUDED.content, embedding=EXCLUDED.embedding`,
      [id, scope, refId || null, content, JSON.stringify(vec)]
    )
  } finally { client.release() }
}

export async function searchMemory(query: string, limit = 5) {
  const openai = getOpenAI()
  if (!openai) return []
  const emb = await openai.embeddings.create({ model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large', input: query })
  const vec = emb.data[0].embedding
  const client = await pool.connect()
  try {
    const { rows } = await client.query(
      `SELECT id, scope, ref_id, content, 1 - (embedding <=> $1) AS score
       FROM memory_vectors
       ORDER BY embedding <=> $1
       LIMIT $2`, [JSON.stringify(vec), limit]
    )
    return rows
  } finally { client.release() }
}
