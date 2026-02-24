/**
 * Generate embeddings via OpenAI. Requires OPENAI_API_KEY.
 * Uses text-embedding-3-small (1536 dimensions).
 */
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;

export function isEmbeddingAvailable() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function embedText(text) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: String(text).slice(0, 8000),
  });
  const vec = res.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length !== EMBEDDING_DIM) {
    throw new Error("Invalid embedding response");
  }
  return vec;
}

export { EMBEDDING_DIM };
