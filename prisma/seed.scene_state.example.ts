import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const char = await prisma.character.findFirst();
  if (!char) {
    console.log('Nessun PG trovato: esegui prima pnpm prisma:seed');
    return;
  }
  await prisma.sceneState.upsert({
    where: { characterId: char.id },
    update: { state: { phase: 'intro', notes: 'avvistata sentinella sui tetti; voci di convoglio a sud' } },
    create: { characterId: char.id, state: { phase: 'intro', notes: 'avvistata sentinella sui tetti; voci di convoglio a sud' } }
  });
  console.log('Scene state inizializzato per', char.name);
}

main().finally(() => prisma.$disconnect());
