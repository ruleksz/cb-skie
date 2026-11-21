import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { clientId, createFakeLlm, createMemoryRepo, parseSse, testConfig } from './helpers.js';

const source = {
  id: 1,
  title: 'Mobile Legends',
  heading: 'Juara',
  source: 'mobile-legends.md',
  content: 'EVOS Legends juara M1.',
  score: 0.9,
};

function setup({ llm = createFakeLlm(), sources = [source] } = {}) {
  const repo = createMemoryRepo();
  const queries = [];
  const retriever = {
    retrieve: async (query) => {
      queries.push(query);
      return sources;
    },
  };
  const app = createApp({ repo, retriever, llm, config: testConfig, staticDir: null });
  return { app, repo, llm, queries };
}

const chat = (app, body, id = clientId) =>
  request(app).post('/api/chat').set('X-Client-Id', id).send(body);

test('GET /api/health melaporkan status', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.llm, { provider: 'fake', model: 'fake-model', configured: true });
});

test('POST /api/chat mengalirkan meta, token, done dan menyimpan riwayat', async () => {
  const { app, repo, llm, queries } = setup({ llm: createFakeLlm({ answer: 'EVOS Legends [1].' }) });
  const res = await chat(app, { message: '  Siapa juara M1?  ' });

  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/event-stream/);
  const events = parseSse(res.text);
  assert.deepEqual(events.map((event) => event.event), ['meta', 'token', 'token', 'token', 'done']);

  const meta = events[0].data;
  assert.equal(meta.title, 'Siapa juara M1?');
  assert.deepEqual(meta.sources, [
    {
      index: 1,
      title: 'Mobile Legends',
      heading: 'Juara',
      source: 'mobile-legends.md',
      excerpt: 'EVOS Legends juara M1.',
      score: 0.9,
    },
  ]);
  assert.deepEqual(queries, ['Siapa juara M1?']);
  assert.equal(llm.calls.complete.length, 0, 'pesan pertama tidak perlu ditulis ulang');
  assert.match(llm.calls.stream[0][0].content, /EVOS Legends juara M1\./);

  const saved = await repo.getMessages(meta.conversationId);
  assert.deepEqual(saved.map((message) => [message.role, message.content]), [
    ['user', 'Siapa juara M1?'],
    ['assistant', 'EVOS Legends [1]. '],
  ]);
  assert.equal(saved[1].sources.length, 1);
  assert.equal(events.at(-1).data.messageId, saved[1].id);
});

test('pertanyaan lanjutan ditulis ulang untuk pencarian dan membawa riwayat', async () => {
  const { app, llm, queries } = setup();
  const first = parseSse((await chat(app, { message: 'Ceritakan M-Series' })).text)[0].data;
  await chat(app, { message: 'siapa juara pertamanya?', conversationId: first.conversationId });

  assert.equal(llm.calls.complete.length, 1);
  assert.equal(queries[1], 'Siapa juara M1 World Championship?');
  const roles = llm.calls.stream[1].map((message) => message.role);
  assert.deepEqual(roles, ['system', 'user', 'assistant', 'user']);
  assert.equal(llm.calls.stream[1].at(-1).content, 'siapa juara pertamanya?');
});

test('validasi masukan', async () => {
  const { app } = setup();
  assert.equal((await chat(app, { message: '   ' })).status, 400);
  assert.equal((await chat(app, { message: 'a'.repeat(2001) })).status, 400);
  assert.equal((await chat(app, { message: 'hai', conversationId: 'bukan-uuid' })).status, 400);
  assert.equal((await chat(app, { message: 'hai' }, 'bukan-uuid')).status, 400);
  assert.equal((await request(app).post('/api/chat').send({ message: 'hai' })).status, 400);
  assert.equal((await chat(app, { message: 'hai', conversationId: randomUUID() })).status, 404);
  const malformed = await request(app)
    .post('/api/chat')
    .set('X-Client-Id', clientId)
    .set('Content-Type', 'application/json')
    .send('{rusak');
  assert.equal(malformed.status, 400);
});

test('LLM belum dikonfigurasi menghasilkan 503 tanpa menyimpan apa pun', async () => {
  const { app, repo } = setup({ llm: createFakeLlm({ configured: false }) });
  const res = await chat(app, { message: 'hai' });
  assert.equal(res.status, 503);
  assert.match(res.body.error, /LLM_API_KEY/);
  assert.equal(repo.conversations.size, 0);
});

test('galat LLM dikirim sebagai event error dan jawaban kosong tidak disimpan', async () => {
  const { app, repo } = setup({ llm: createFakeLlm({ fail: true }) });
  const events = parseSse((await chat(app, { message: 'hai' })).text);
  assert.deepEqual(events.map((event) => event.event), ['meta', 'error']);
  assert.match(events[1].data.message, /401/);
  assert.deepEqual(repo.messages.map((message) => message.role), ['user']);
});

test('riwayat percakapan terpisah per klien', async () => {
  const { app } = setup();
  const { conversationId } = parseSse((await chat(app, { message: 'Apa itu esports?' })).text)[0].data;
  const other = randomUUID();

  const list = await request(app).get('/api/conversations').set('X-Client-Id', clientId);
  assert.deepEqual(list.body.conversations.map((item) => item.id), [conversationId]);
  const otherList = await request(app).get('/api/conversations').set('X-Client-Id', other);
  assert.deepEqual(otherList.body.conversations, []);

  const detail = await request(app).get(`/api/conversations/${conversationId}`).set('X-Client-Id', clientId);
  assert.equal(detail.body.messages.length, 2);
  assert.equal(
    (await request(app).get(`/api/conversations/${conversationId}`).set('X-Client-Id', other)).status,
    404,
  );
  assert.equal(
    (await request(app).delete(`/api/conversations/${conversationId}`).set('X-Client-Id', other)).status,
    404,
  );
  assert.equal(
    (await request(app).delete(`/api/conversations/${conversationId}`).set('X-Client-Id', clientId)).status,
    204,
  );
  assert.equal(
    (await request(app).get(`/api/conversations/${conversationId}`).set('X-Client-Id', clientId)).status,
    404,
  );
});

test('endpoint API yang tidak ada mengembalikan 404 JSON', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/tidak-ada');
  assert.equal(res.status, 404);
  assert.ok(res.body.error);
});

test('coba lagi mengganti giliran yang gagal, bukan menumpuknya', async () => {
  const { app, repo } = setup();
  const { conversationId } = parseSse((await chat(app, { message: 'Apa itu esports?' })).text)[0].data;
  await chat(app, { message: 'Siapa Faker?', conversationId });
  await chat(app, { message: 'Siapa Faker?', conversationId, retry: true });

  const saved = await repo.getMessages(conversationId);
  assert.deepEqual(saved.map((message) => [message.role, message.content.trim()]), [
    ['user', 'Apa itu esports?'],
    ['assistant', 'Jawaban uji.'],
    ['user', 'Siapa Faker?'],
    ['assistant', 'Jawaban uji.'],
  ]);

  await chat(app, { message: 'Pertanyaan lain', conversationId, retry: true });
  assert.equal((await repo.getMessages(conversationId)).length, 6, 'pesan berbeda tidak menghapus apa pun');
});

test('pencarian gagal tetap mengirim id percakapan lewat meta', async () => {
  const { repo } = setup();
  const failing = createApp({
    repo,
    retriever: { retrieve: async () => Promise.reject(new Error('embedding mati')) },
    llm: createFakeLlm(),
    config: testConfig,
    staticDir: null,
  });
  const events = parseSse((await chat(failing, { message: 'Apa itu esports?' })).text);
  assert.deepEqual(events.map((event) => event.event), ['meta', 'error']);
  assert.ok(repo.conversations.has(events[0].data.conversationId));
  assert.deepEqual(events[0].data.sources, []);
});

test('gagal menyimpan jawaban dilaporkan sebagai event error, bukan done', async () => {
  const { app, repo } = setup();
  const addMessage = repo.addMessage;
  repo.addMessage = async (message) => {
    if (message.role === 'assistant') throw new Error('MySQL putus');
    return addMessage(message);
  };
  const events = parseSse((await chat(app, { message: 'Apa itu esports?' })).text);
  assert.equal(events.at(-1).event, 'error');
  assert.ok(!events.some((event) => event.event === 'done'));
});
