/**
 * Upstash Vector client. Requires UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN.
 * Uses Upstash built-in embeddings: create index with an embedding model (e.g. BAAI/bge-small-en-v1.5)
 * and dimensions matching that model (384 for bge-small). No OpenAI key needed.
 */
export function isVectorAvailable() {
  return Boolean(
    process.env.UPSTASH_VECTOR_REST_URL?.trim() &&
      process.env.UPSTASH_VECTOR_REST_TOKEN?.trim()
  );
}

let indexClient = null;

async function getIndex() {
  if (!indexClient) {
    const { Index } = await import("@upstash/vector");
    indexClient = new Index({
      url: process.env.UPSTASH_VECTOR_REST_URL,
      token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    });
  }
  return indexClient;
}

/** Upsert with text data – Upstash embeds server-side (index must have embedding model) */
export async function upsertData(items) {
  const index = await getIndex();
  await index.upsert(items.map(({ id, data, metadata }) => ({ id, data: String(data).slice(0, 8000), metadata })));
}

/** Query by text – Upstash embeds query server-side and returns matches */
export async function queryByData(queryText, options = {}) {
  const { topK = 20, filter } = options;
  const index = await getIndex();
  const res = await index.query({
    data: String(queryText).slice(0, 8000),
    topK,
    includeMetadata: true,
    ...(filter && { filter }),
  });
  return res ?? [];
}

export async function deleteByIds(ids) {
  if (!ids?.length) return;
  const index = await getIndex();
  await index.deleteByIds(ids);
}

export async function reset() {
  const index = await getIndex();
  await index.reset();
}
