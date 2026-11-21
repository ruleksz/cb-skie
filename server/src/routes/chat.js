import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { isUuid, requireClientId } from '../http.js';
import { buildChatMessages, buildRewriteMessages } from '../rag/prompt.js';

export const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_LIMIT = 8;
const TITLE_LENGTH = 60;

function makeTitle(message) {
  const singleLine = message.replace(/\s+/g, ' ').trim();
  return singleLine.length > TITLE_LENGTH
    ? `${singleLine.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
    : singleLine;
}

function toPublicSource(source, index) {
  return {
    index: index + 1,
    title: source.title,
    heading: source.heading,
    source: source.source,
    excerpt: source.content,
    score: source.score,
  };
}

export function chatRouter({ repo, retriever, llm }) {
  const router = Router();

  // Pertanyaan lanjutan ("kalau yang tahun 2019?") dijadikan pertanyaan mandiri agar pencarian tepat.
  async function toStandaloneQuestion(question, history, signal) {
    if (history.length === 0) return question;
    try {
      const rewritten = await llm.complete(buildRewriteMessages({ question, history }), {
        signal,
        temperature: 0,
      });
      return rewritten && rewritten.length <= MAX_MESSAGE_LENGTH ? rewritten : question;
    } catch (error) {
      if (signal.aborted) throw error;
      return question;
    }
  }

  router.post('/', requireClientId, async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const requestedId = req.body?.conversationId;

    if (!message) {
      res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: `Pesan maksimal ${MAX_MESSAGE_LENGTH} karakter.` });
      return;
    }
    if (requestedId != null && !isUuid(requestedId)) {
      res.status(400).json({ error: 'conversationId tidak valid.' });
      return;
    }
    if (!llm.isConfigured) {
      res.status(503).json({
        error: `LLM belum dikonfigurasi. Isi ${llm.missing.join(', ')} di berkas .env lalu jalankan ulang server.`,
      });
      return;
    }

    let conversation;
    if (requestedId) {
      conversation = await repo.getConversation(requestedId, req.clientId);
      if (!conversation) {
        res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
        return;
      }
    } else {
      conversation = await repo.createConversation({
        id: randomUUID(),
        clientId: req.clientId,
        title: makeTitle(message),
      });
    }

    // Coba lagi: giliran terakhir yang gagal diganti, bukan ditumpuk di riwayat.
    if (requestedId && req.body?.retry === true) await repo.deleteLastTurn(conversation.id, message);

    const history = await repo.getMessages(conversation.id, { limit: HISTORY_LIMIT });
    await repo.addMessage({ conversationId: conversation.id, role: 'user', content: message });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    const send = (event, data) => {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    let answer = '';
    let sources = [];
    let metaSent = false;
    const sendMeta = () => {
      send('meta', { conversationId: conversation.id, title: conversation.title, sources });
      metaSent = true;
    };
    try {
      const searchQuery = await toStandaloneQuestion(message, history, abort.signal);
      sources = (await retriever.retrieve(searchQuery)).map(toPublicSource);
      sendMeta();

      const messages = buildChatMessages({
        question: message,
        history,
        sources: sources.map(({ title, heading, excerpt }) => ({ title, heading, content: excerpt })),
      });
      for await (const text of llm.streamChat(messages, { signal: abort.signal })) {
        answer += text;
        send('token', { text });
      }
      if (!answer.trim()) throw new Error('Model tidak mengembalikan jawaban.');
    } catch (error) {
      // Klien tetap perlu tahu id percakapan agar pesan berikutnya masuk ke percakapan yang sama.
      if (!metaSent) sendMeta();
      if (!abort.signal.aborted) {
        console.error('[chat] gagal menjawab:', error.message);
        send('error', {
          message:
            error.name === 'LlmError'
              ? error.message
              : 'Terjadi kesalahan saat menyusun jawaban. Coba lagi sebentar lagi.',
        });
      }
    }

    // Jawaban yang terpotong (dihentikan pengguna atau galat di tengah) tetap disimpan agar riwayat konsisten.
    if (answer.trim()) {
      try {
        const messageId = await repo.addMessage({
          conversationId: conversation.id,
          role: 'assistant',
          content: answer,
          sources,
        });
        await repo.touchConversation(conversation.id);
        send('done', { messageId });
      } catch (error) {
        console.error('[chat] gagal menyimpan jawaban:', error.message);
        send('error', { message: 'Jawaban tidak dapat disimpan ke riwayat percakapan.' });
      }
    }
    res.end();
  });

  return router;
}
