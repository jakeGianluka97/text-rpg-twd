import OpenAI from 'openai'
export function getOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  const baseURL = process.env.OPENAI_BASE_URL
  return new OpenAI({ apiKey: key, baseURL })
}
export const MODEL = process.env.OPENAI_MODEL || 'llama3'
