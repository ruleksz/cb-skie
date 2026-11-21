import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { repoRoot } from './config.js';
import { chatRouter } from './routes/chat.js';
import { conversationsRouter } from './routes/conversations.js';

export function createApp({ repo, retriever, llm, config, staticDir = path.join(repoRoot, 'client', 'dist') }) {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');
  app.use(cors({ origin: config.clientOrigins }));
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', async (_req, res) => {
    let database = true;
    let chunks = 0;
    try {
      chunks = await repo.countChunks();
    } catch {
      database = false;
    }
    res.status(database ? 200 : 503).json({
      ok: database,
      database,
      knowledgeChunks: chunks,
      llm: { provider: llm.provider, model: llm.model, configured: llm.isConfigured },
    });
  });

  const chatLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.' },
  });
  app.use('/api/chat', chatLimiter, chatRouter({ repo, retriever, llm }));
  app.use('/api/conversations', conversationsRouter({ repo }));
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
  });

  // Di produksi, hasil build frontend dilayani oleh server yang sama.
  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use((error, _req, res, _next) => {
    if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
      res.status(400).json({ error: 'Isi permintaan tidak valid.' });
      return;
    }
    console.error('[server]', error);
    if (res.headersSent) {
      res.end();
      return;
    }
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  });

  return app;
}
