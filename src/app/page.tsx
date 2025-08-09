import Link from 'next/link'

export default function Home() {
  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold">TWD-RPG — MVP</h1>
      <p className="mt-4 opacity-80">Crea il tuo personaggio e avvia una sessione con il Game Master.</p>
      <div className="mt-6 flex gap-3">
        <Link className="px-3 py-2 bg-emerald-600 rounded" href="/game">Entra nel gioco</Link>
      </div>
    </main>
  )
}
