import './globals.css'
import React from 'react'

export const metadata = { title: 'TWD-RPG' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-zinc-900 text-zinc-100">{children}</body>
    </html>
  )
}
