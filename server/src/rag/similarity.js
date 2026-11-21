export function normalize(vector) {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const length = Math.sqrt(sum);
  if (length === 0) return Array.from(vector);
  return Array.from(vector, (value) => value / length);
}

export function dot(a, b) {
  if (a.length !== b.length) {
    throw new Error(`Dimensi vektor berbeda (${a.length} vs ${b.length}). Jalankan ulang ingest.`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

export function cosineSimilarity(a, b) {
  return dot(normalize(a), normalize(b));
}

/** Reciprocal Rank Fusion: menggabungkan beberapa daftar peringkat id menjadi satu skor. */
export function reciprocalRankFusion(rankings, k = 60) {
  const scores = new Map();
  for (const ranking of rankings) {
    ranking.forEach((id, index) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1));
    });
  }
  return scores;
}
