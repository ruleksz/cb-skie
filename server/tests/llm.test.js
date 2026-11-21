import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig } from '../src/config.js';
import { createLlmClient, parseChatStream } from '../src/llm/client.js';
import { buildChatMessages, buildRewriteMessages } from '../src/rag/prompt.js';

const encoder = new TextEncoder();
async function* bytes(...parts) {
  for (const part of parts) yield encoder.encode(part);
}
const delta = (content) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

test('parseChatStream merangkai token walau baris terpotong antar chunk', async () => {
  const payload = delta('Halo') + delta(' dunia') + 'data: [DONE]\n\n' + delta('diabaikan');
  const out = [];
  for await (const text of parseChatStream(bytes(payload.slice(0, 17), payload.slice(17, 60), payload.slice(60)))) {
    out.push(text);
  }
  assert.equal(out.join(''), 'Halo dunia');
});

test('klien mengirim permintaan Chat Completions dan membaca aliran', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return new Response(delta('Hai') + 'data: [DONE]\n\n', { status: 200 });
  };
  const llm = createLlmClient(
    { provider: 'gemini', apiKey: 'kunci', model: 'model-x', baseUrl: 'https://contoh.test/v1' },
    { fetchImpl },
  );
  let answer = '';
  for await (const text of llm.streamChat([{ role: 'user', content: 'hai' }])) answer += text;

  assert.equal(answer, 'Hai');
  assert.equal(captured.url, 'https://contoh.test/v1/chat/completions');
  assert.equal(captured.init.headers.Authorization, 'Bearer kunci');
  const body = JSON.parse(captured.init.body);
  assert.equal(body.model, 'model-x');
  assert.equal(body.stream, true);
});

test('galat dari penyedia menjadi LlmError dengan status', async () => {
  const llm = createLlmClient(
    { provider: 'openai', apiKey: 'salah', model: 'm', baseUrl: 'https://contoh.test/v1' },
    { fetchImpl: async () => new Response('invalid key', { status: 401 }) },
  );
  await assert.rejects(llm.complete([{ role: 'user', content: 'hai' }]), (error) => {
    assert.equal(error.name, 'LlmError');
    assert.equal(error.status, 401);
    return true;
  });
});

test('konfigurasi: bawaan gemini, penyedia lain wajib LLM_MODEL', () => {
  const gemini = loadConfig({ LLM_PROVIDER: 'gemini', LLM_API_KEY: 'k' });
  assert.match(gemini.llm.baseUrl, /generativelanguage\.googleapis\.com/);
  assert.ok(createLlmClient(gemini.llm).isConfigured);

  const noKey = createLlmClient(loadConfig({ LLM_PROVIDER: 'gemini' }).llm);
  assert.equal(noKey.isConfigured, false);
  assert.deepEqual(noKey.missing, ['LLM_API_KEY']);

  const groq = createLlmClient(loadConfig({ LLM_PROVIDER: 'groq', LLM_API_KEY: 'k' }).llm);
  assert.deepEqual(groq.missing, ['LLM_MODEL']);

  const custom = loadConfig({ LLM_PROVIDER: 'custom', LLM_BASE_URL: 'http://localhost:11434/v1/', LLM_MODEL: 'm' });
  assert.equal(custom.llm.baseUrl, 'http://localhost:11434/v1');
  assert.ok(createLlmClient(custom.llm).isConfigured);

  assert.throws(() => loadConfig({ LLM_PROVIDER: 'entah' }), /tidak dikenal/);
});

test('prompt memuat konteks bernomor, riwayat, lalu pertanyaan', () => {
  const messages = buildChatMessages({
    question: 'Siapa juaranya?',
    history: [{ role: 'user', content: 'Halo', sources: [] }],
    sources: [{ title: 'MLBB', heading: 'Juara', content: 'EVOS Legends juara M1.' }],
  });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /\[1\] MLBB — Juara\nEVOS Legends juara M1\./);
  assert.deepEqual(messages[1], { role: 'user', content: 'Halo' });
  assert.deepEqual(messages.at(-1), { role: 'user', content: 'Siapa juaranya?' });

  const empty = buildChatMessages({ question: 'x' });
  assert.match(empty[0].content, /Tidak ada potongan pengetahuan yang relevan/);

  const rewrite = buildRewriteMessages({ question: 'kalau M2?', history: [{ role: 'user', content: 'Juara M1?' }] });
  assert.match(rewrite[1].content, /Pengguna: Juara M1\?/);
});
