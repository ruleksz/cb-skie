import { dot, reciprocalRankFusion } from './similarity.js';

const CANDIDATES = 20;

export function createRetriever({ repo, embedder, topK = 5, minScore = 0.81 }) {
  let cache = { stamp: null, chunks: [] };

  async function loadChunks() {
    const stamp = await repo.getKnowledgeStamp();
    if (stamp !== cache.stamp) {
      cache = { stamp, chunks: await repo.getAllChunks() };
    }
    return cache.chunks;
  }

  /**
   * Pencarian hibrida: kemiripan vektor digabung dengan FULLTEXT MySQL lewat RRF.
   * Hanya potongan dengan kemiripan kosinus >= minScore yang dikembalikan.
   */
  async function retrieve(query) {
    const [queryVector, chunks, keywordIds] = await Promise.all([
      embedder.embedQuery(query),
      loadChunks(),
      repo.keywordSearch(query, CANDIDATES).catch(() => []),
    ]);
    if (chunks.length === 0) return [];

    const scored = chunks
      .map((chunk) => ({ chunk, score: dot(queryVector, chunk.embedding) }))
      .sort((a, b) => b.score - a.score);
    const scoreById = new Map(scored.map(({ chunk, score }) => [chunk.id, score]));
    const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));

    const vectorIds = scored.slice(0, CANDIDATES).map(({ chunk }) => chunk.id);
    const fused = reciprocalRankFusion([vectorIds, keywordIds.filter((id) => chunkById.has(id))]);

    return [...fused.entries()]
      .filter(([id]) => scoreById.get(id) >= minScore)
      .sort((a, b) => b[1] - a[1] || scoreById.get(b[0]) - scoreById.get(a[0]))
      .slice(0, topK)
      .map(([id]) => {
        const chunk = chunkById.get(id);
        return {
          id,
          title: chunk.title,
          source: chunk.source,
          heading: chunk.heading,
          content: chunk.content,
          score: Number(scoreById.get(id).toFixed(4)),
        };
      });
  }

  return { retrieve };
}
