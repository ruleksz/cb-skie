import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chunkMarkdown, chunkToEmbeddingText } from '../src/rag/chunker.js';

test('memakai H1 sebagai judul dan memecah per heading', () => {
  const { title, chunks } = chunkMarkdown(
    '# Dota 2\n\nPembuka.\n\n## Posisi\n\nCarry dan support.\n\n### Carry\n\nPosisi 1.\n\n## Turnamen\n\nThe International.',
  );
  assert.equal(title, 'Dota 2');
  assert.deepEqual(
    chunks.map((chunk) => chunk.heading),
    ['', 'Posisi', 'Posisi > Carry', 'Turnamen'],
  );
  assert.equal(chunks[2].content, 'Posisi 1.');
});

test('memakai judul cadangan bila tidak ada H1 dan melewati bagian kosong', () => {
  const { title, chunks } = chunkMarkdown('## Kosong\n\n## Isi\n\nTeks.', { fallbackTitle: 'berkas' });
  assert.equal(title, 'berkas');
  assert.deepEqual(chunks, [{ heading: 'Isi', content: 'Teks.' }]);
});

test('bagian panjang dipecah per paragraf tanpa melewati batas', () => {
  const paragraph = 'Kalimat tentang esports. '.repeat(10).trim();
  const { chunks } = chunkMarkdown(`# T\n\n## Panjang\n\n${[paragraph, paragraph, paragraph].join('\n\n')}`, {
    maxChars: 300,
  });
  assert.ok(chunks.length >= 3);
  for (const chunk of chunks) {
    assert.equal(chunk.heading, 'Panjang');
    assert.ok(chunk.content.length <= 300, `potongan ${chunk.content.length} karakter`);
  }
});

test('paragraf tunggal yang melebihi batas dipecah per kalimat', () => {
  const { chunks } = chunkMarkdown(`# T\n\n${'Satu kalimat pendek. '.repeat(40)}`, { maxChars: 200 });
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.content.length <= 200));
  assert.ok(chunks.every((chunk) => chunk.content.endsWith('.')));
});

test('tanda # di dalam blok kode tidak dianggap heading', () => {
  const { chunks } = chunkMarkdown('# T\n\n## A\n\n```\n# bukan heading\n```\n');
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].content, /# bukan heading/);
});

test('teks embedding menyertakan judul dan heading', () => {
  assert.equal(
    chunkToEmbeddingText('Dota 2', { heading: 'Posisi', content: 'Carry.' }),
    'Dota 2 — Posisi\nCarry.',
  );
});

test('titik di dalam angka tidak membuang teks saat paragraf panjang dipecah', () => {
  const paragraph =
    'Pada 1980 Atari menggelar kejuaraan dengan lebih dari 10.000 peserta. ' +
    'Hadiah turnamen modern mencapai US$ 40.018.195 pada 2021. '.repeat(6).trim();
  const { chunks } = chunkMarkdown(`# T\n\n${paragraph}`, { maxChars: 150 });
  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((chunk) => chunk.content).join(' '), paragraph);
});
