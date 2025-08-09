# GM persistente v1.1 (Ollama + Tools simulati)

## Cos'è
- Game Master che usa un **loop** di azioni JSON (simil-tools) per interrogare il DB e aggiornare lo stato.
- Stato scena persistente in tabella `SceneState` (una riga per personaggio).
- Anti-ripetizione e progressione forzata.

## Installazione
1. Copia questi file nella root della repo (sovrascrivi quelli esistenti).
2. Migrazione Prisma:
   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev --name init_scene_state
   ```
3. (Facoltativo) Seed stato scena:
   ```bash
   pnpm tsx prisma/seed.scene_state.example.ts
   ```
4. Avvio:
   ```bash
   pnpm dev
   ```

## ENV (Ollama)
```
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3
OPENAI_EMBEDDING_MODEL=mxbai-embed-large
```

## Come funziona
- Il modello sceglie un'azione per volta (`world_context`, `query_events`, `rag_search`, `get/set_scene_state`, ...).
- Il server **esegue** e restituisce l'**Osservazione**.
- Quando è pronto, il modello manda `{"action":"final","parameters":{"reply":"..."}}` con 2–4 opzioni.
- Il testo finale viene mostrato in chat e gli effetti sono salvati in Event/SceneState.

## Debug
- `GET /api/health/llm` mostra lo stato LLM.
- Abilita log delle azioni nel server per diagnosi.
