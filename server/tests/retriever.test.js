import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRetriever } from '../src/rag/retriever.js';
import { cosineSimilarity, normalize, reciprocalRankFusion } from '../src/rag/similarity.js';
import { createMemoryRepo } from './helpers.js';

const chunk = (id, embedding, content) => ({
  id,
  embedding: normalize(embedding),
  content,
  heading: `Bagian ${id}`,
  title: 'Dokumen',
  source: 'dokumen.md',
});

const chunks = [
  chunk(1, [1, 0, 0], 'EVOS Legends juara M1.'),
  chunk(2, [0.9, 0.3, 0], 'Format double elimination.'),
  chunk(3, [0, 1, 0], 'Resep masakan.'),
];
const embedderFor = (vector) => ({ embedQuery: async () => normalize(vector) });

test('cosineSimilarity dan normalize', () => {
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.ok(Math.abs(cosineSimilarity([2, 0], [5, 0]) - 1) < 1e-9);
  assert.deepEqual(normalize([0, 0]), [0, 0]);
  assert.throws(() => cosineSimilarity([1, 0], [1, 0, 0]), /Dimensi vektor berbeda/);
});

test('reciprocalRankFusion mengutamakan id yang muncul di kedua daftar', () => {
  const scores = reciprocalRankFusion([[1, 2, 3], [3, 1]]);
  assert.ok(scores.get(1) > scores.get(3));
  assert.ok(scores.get(3) > scores.get(2));
});

test('mengembalikan potongan paling mirip dan membuang yang di bawah ambang', async () => {
  const retriever = createRetriever({
    repo: createMemoryRepo({ chunks }),
    embedder: embedderFor([1, 0, 0]),
    topK: 5,
    minScore: 0.5,
  });
  const results = await retriever.retrieve('siapa juara');
  assert.deepEqual(results.map((result) => result.id), [1, 2]);
  assert.equal(results[0].score, 1);
  assert.equal(results[0].source, 'dokumen.md');
  assert.equal(results[0].embedding, undefined);
});

test('membatasi hasil sebanyak topK', async () => {
  const retriever = createRetriever({
    repo: createMemoryRepo({ chunks }),
    embedder: embedderFor([1, 1, 0]),
    topK: 1,
    minScore: 0,
  });
  assert.equal((await retriever.retrieve('apa saja')).length, 1);
});

test('kecocokan kata kunci menaikkan peringkat tetapi tidak meloloskan potongan tak relevan', async () => {
  const retriever = createRetriever({
    repo: createMemoryRepo({ chunks }),
    embedder: embedderFor([1, 0, 0]),
    topK: 5,
    minScore: 0.5,
  });
  const boosted = await retriever.retrieve('double elimination');
  assert.deepEqual(boosted.map((result) => result.id), [2, 1]);
  const offTopic = await retriever.retrieve('resep masakan');
  assert.ok(!offTopic.some((result) => result.id === 3));
});

test('basis pengetahuan kosong menghasilkan daftar kosong', async () => {
  const retriever = createRetriever({ repo: createMemoryRepo(), embedder: embedderFor([1, 0, 0]) });
  assert.deepEqual(await retriever.retrieve('apa pun'), []);
});
