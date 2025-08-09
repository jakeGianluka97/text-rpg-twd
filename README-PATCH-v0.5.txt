v0.5 PATCH (Ollama-ready)
- GM senza 'tools': planner JSON eseguito lato server.
- Health check: GET /api/health/llm
- Chat con gestione errori.
- .env.example per Ollama (OPENAI_BASE_URL, MODEL=llama3).
- pgvector init: embedding 1024 per mxbai-embed-large.

Istruzioni:
1) Scompatta questo patch nella root del progetto (sovrascrivi i file).
2) Aggiorna .env con le stesse variabili di .env.example (o copia-incolla).
3) Ricrea il DB (se vuoi usare i 1024 dims):
   docker compose down -v && docker compose up -d
4) Avvia:
   pnpm install
   pnpm prisma generate
   pnpm prisma migrate dev
   pnpm prisma:seed
   pnpm dev
