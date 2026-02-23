# Vector Search Setup (Upstash)

Faster semantic search using Upstash Vector with **built-in embeddings**. No OpenAI key needed.

## 1. Create Upstash Vector index

**Important**: The index must have an **Embedding model** selected (e.g. BAAI/bge-small-en-v1.5), not "Custom". That enables server-side embedding.

1. Go to [console.upstash.com/vector](https://console.upstash.com/vector)
2. Create a new index
3. **Name**: e.g. `file-organizer`
4. **Type**: Dense
5. **Embedding model**: Choose one (e.g. **BAAI/bge-small-en-v1.5** – 384 dims)
6. **Dimensions**: Set automatically by the model (384 for bge-small)
7. **Metric**: cosine
8. Copy the REST URL and token

## 2. Environment variables

Add to `.env.local`:

```env
UPSTASH_VECTOR_REST_URL=https://xxx.upstash.io
UPSTASH_VECTOR_REST_TOKEN=xxx
```

No OpenAI key required – Upstash embeds text server-side.

## 3. Index your files

1. Open the File Manager tab
2. Click **AI** to open the AI panel
3. Click **"Index for search"** to index the current folder (or root)
4. Semantic search (e.g. "find cat photos") will use the vector index when available

## Flow

- **Without vector index**: Each semantic search sends file contents (PDF text, images) to Gemini. Works but slower.
- **With vector index**: Search uses Upstash built-in embeddings; results come from Upstash. Falls back to Gemini if vector returns nothing.

## Costs

- **Upstash Vector**: Free tier available; embedding is included. See [upstash.com/pricing](https://upstash.com/pricing)
