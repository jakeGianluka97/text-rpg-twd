# TWD-RPG v1.0

## v1.0 — LLaMA Simulated Tools (Ollama)
- GM con **loop di pianificazione** e **tools simulati** via JSON (query eventi, upsert, RAG, pathfinding, world context).
- Compatibile con **Ollama** (`OPENAI_BASE_URL=http://localhost:11434/v1`, `OPENAI_MODEL=llama3`).
- Health check: `/api/health/llm`.

### ENV (Ollama)
```
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3
OPENAI_EMBEDDING_MODEL=mxbai-embed-large
```
