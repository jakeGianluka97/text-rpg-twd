-- Memory vectors table for embeddings (mxbai-embed-large = 1024 dims)
CREATE TABLE IF NOT EXISTS memory_vectors (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  ref_id TEXT,
  content TEXT NOT NULL,
  embedding vector(1024),
  ts TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_vectors_embedding_idx
  ON memory_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
