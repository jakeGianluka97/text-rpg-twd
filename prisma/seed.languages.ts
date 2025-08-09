import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const langs = [
    { code: 'it', name: 'Italiano', type: 'language', region: 'it-IT' },
    { code: 'nap', name: 'Napoletano', type: 'dialect', region: 'it-NAP' },
    { code: 'en', name: 'Inglese', type: 'language', region: 'en' },
    { code: 'es', name: 'Spagnolo', type: 'language', region: 'es' },
  ]
  for (const l of langs) {
    await prisma.language.upsert({ where: { code: l.code }, update: l, create: l })
  }
  console.log('Lingue ok')
}
main().finally(() => prisma.$disconnect())
