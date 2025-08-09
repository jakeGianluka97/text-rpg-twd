// src/components/DebugBar.tsx
'use client'
export default function DebugBar({ characterId, scene, events }:{
  characterId: string | null
  scene?: any
  events?: any[]
}) {
  return (
    <div className="text-xs p-2 border border-zinc-700 rounded bg-zinc-900/60">
      <div>ID PG: <b>{characterId ?? '—'}</b></div>
      <div>SceneState.location: <b>{scene?.location?.lat ?? '—'},{scene?.location?.lon ?? '—'}</b></div>
      <div>Eventi PG: <b>{events?.length ?? 0}</b></div>
    </div>
  )
}
