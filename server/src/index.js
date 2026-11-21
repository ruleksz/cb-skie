import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createPool } from './db/pool.js';
import { createRepository } from './db/repository.js';
import { createLlmClient } from './llm/client.js';
import { createEmbedder } from './rag/embedder.js';
import { createRetriever } from './rag/retriever.js';

const config = loadConfig();
const pool = createPool(config.db);
const repo = createRepository(pool);
const embedder = createEmbedder(config.embedding);
const retriever = createRetriever({ repo, embedder, ...config.rag });
const llm = createLlmClient(config.llm);

const app = createApp({ repo, retriever, llm, config });
const server = app.listen(config.port, () => {
  console.log(`Server berjalan di http://localhost:${config.port}`);
  if (!llm.isConfigured) {
    console.warn(`LLM belum dikonfigurasi: isi ${llm.missing.join(', ')} di berkas .env.`);
  }
});

repo
  .countChunks()
  .then((count) => {
    if (count === 0) console.warn('Basis pengetahuan kosong. Jalankan: npm run ingest');
  })
  .catch((error) => {
    console.error(`Tidak bisa terhubung ke MySQL (${error.code ?? error.message}). Cek .env dan jalankan: npm run db:up && npm run migrate`);
  });

// Model embedding dimuat di awal supaya pertanyaan pertama tidak menunggu lama.
embedder.warmup().catch((error) => {
  console.error('Gagal memuat model embedding:', error.message);
});

const SHUTDOWN_TIMEOUT_MS = 15_000;
let shuttingDown = false;

// Jawaban yang sedang dialirkan diberi waktu untuk selesai dan tersimpan sebelum proses berhenti.
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
  server.close(async () => {
    await pool.end().catch(() => {});
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
