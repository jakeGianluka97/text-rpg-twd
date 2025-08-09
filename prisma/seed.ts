import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // Lingue e dialetti base
  const langs = [
    { code: 'it', name: 'Italiano', type: 'language', region: 'IT' },
    { code: 'es', name: 'Spagnolo', type: 'language', region: 'ES' },
    { code: 'en_us', name: 'Inglese (USA)', type: 'language', region: 'US' },
    { code: 'nap', name: 'Napoletano', type: 'dialect', region: 'Campania' },
  ];
  for (const l of langs) await prisma.language.upsert({
    where: { code: l.code },
    update: l,
    create: l,
  });

  // Luoghi demo
  await prisma.location.createMany({ data: [
    { name: 'Napoli — Centro Storico', kind: 'city_district', lat: 40.8529, lon: 14.2681, region: 'Campania', tags: ['urbano','rischio_razzia'], dangerLevel: 2, lastState: { status: 'conteso' } },
    { name: 'Caserta — Campagna', kind: 'rural', lat: 41.0700, lon: 14.3300, region: 'Campania', tags: ['campi','rifugi'], dangerLevel: 1, lastState: { status: 'sparso' } },
  ], skipDuplicates: true });

  // Player demo + PG
  const player = await prisma.player.upsert({
    where: { email: 'demo@twd.local' },
    update: {},
    create: { email: 'demo@twd.local', name: 'Demo', locale: 'it-IT' }
  });

  const char = await prisma.character.create({ data: {
    playerId: player.id,
    name: 'Jake Milton',
    concept: 'Sopravvissuto pragmatico',
    backstory: 'Ex volontario della protezione civile, ora vagabondo armato di zaino e buon senso.',
    originLocale: 'it-IT',
    traits: { nerve: 2, empathy: 1 },
    stats: { str: 10, dex: 12, int: 13, wis: 14, cha: 9 },
    proficiency: { survival: 2, firearms: 1 }
  }});

  await prisma.characterLanguage.createMany({ data: [
    { characterId: char.id, languageCode: 'it', level: 5 },
    { characterId: char.id, languageCode: 'nap', level: 1 },
  ]});

  await prisma.event.create({ data: {
    kind: 'world_seed',
    summary: 'Insediamenti sparsi in Campania. Voci di un convoglio a sud.',
    payload: {},
    gmAsserted: true
  }});

  // NPC demo
  await prisma.nPC.upsert({
    where: { id: 'sentinella-napoli' },
    update: { name: 'Sentinella di Napoli', profile: { role: 'guard' } },
    create: { id: 'sentinella-napoli', name: 'Sentinella di Napoli', profile: { role: 'guard' }, alive: true }
  });

  // Waypoints
  const nap = await prisma.location.findFirst({ where: { name: { contains: 'Napoli' } } })
  const cas = await prisma.location.findFirst({ where: { name: { contains: 'Caserta' } } })
  if (nap && cas) {
    await prisma.waypoint.createMany({ data: [
      { fromId: nap.id, toId: cas.id, travelMin: 75, risk: 2 },
      { fromId: cas.id, toId: nap.id, travelMin: 75, risk: 2 },
    ], skipDuplicates: true })
  }

  // NPC interprete con lingue
  const npc2 = await prisma.nPC.upsert({
    where: { id: 'maria-interprete' },
    update: { name: 'Maria la Mediatrice', profile: { role: 'interpreter' } },
    create: { id: 'maria-interprete', name: 'Maria la Mediatrice', profile: { role: 'interpreter' }, alive: true }
  })
  await prisma.nPCLanguage.upsert({ where: { npcId_languageCode: { npcId: npc2.id, languageCode: 'it' } }, update: { level: 5 }, create: { npcId: npc2.id, languageCode: 'it', level: 5 } })
  await prisma.nPCLanguage.upsert({ where: { npcId_languageCode: { npcId: npc2.id, languageCode: 'nap' } }, update: { level: 5 }, create: { npcId: npc2.id, languageCode: 'nap', level: 5 } })
  await prisma.nPCLanguage.upsert({ where: { npcId_languageCode: { npcId: npc2.id, languageCode: 'es' } }, update: { level: 3 }, create: { npcId: npc2.id, languageCode: 'es', level: 3 } })

  console.log('Seed completato.')
}

main().finally(() => prisma.$disconnect());
