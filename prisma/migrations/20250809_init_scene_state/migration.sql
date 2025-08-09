-- CreateTable: SceneState
CREATE TABLE IF NOT EXISTS "SceneState" (
  "characterId" TEXT PRIMARY KEY,
  "state" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional columns on Event (phase, impact)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "phase" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "impact" TEXT;
