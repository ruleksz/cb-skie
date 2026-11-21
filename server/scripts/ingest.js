import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig, serverRoot } from '../src/config.js';
import { migrate } from '../src/db/migrate.js';
import { createPool } from '../src/db/pool.js';
import { createRepository } from '../src/db/repository.js';
import { chunkMarkdown, chunkToEmbeddingText } from '../src/rag/chunker.js';
import { createEmbedder } from '../src/rag/embedder.js';

const BATCH_SIZE = 16;
const force = process.argv.includes('--force');
const knowledgeDir = path.join(serverRoot, 'knowledge');

async function listMarkdownFiles(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdownFiles(fullPath, base)));
    else if (/\.(md|markdown|txt)$/i.test(entry.name)) {
      files.push(path.relative(base, fullPath).split(path.sep).join('/'));
    }
  }
  return files.sort();
}

const config = loadConfig();
const pool = createPool(config.db);
const repo = createRepository(pool);
const embedder = createEmbedder(config.embedding);

try {
  await migrate(pool);
  const files = await listMarkdownFiles(knowledgeDir);
  if (files.length === 0) {
    console.warn(`Tidak ada berkas .md di ${knowledgeDir}`);
  }

  let updated = 0;
  let skipped = 0;
  let totalChunks = 0;

  for (const source of files) {
    const text = await fs.readFile(path.join(knowledgeDir, source), 'utf8');
    const contentHash = createHash('sha256').update(text).digest('hex');
    const existing = await repo.getDocumentBySource(source);
    if (
      !force &&
      existing &&
      existing.contentHash === contentHash &&
      existing.embeddingModel === embedder.model
    ) {
      skipped += 1;
      continue;
    }

    const { title, chunks } = chunkMarkdown(text, {
      fallbackTitle: path.basename(source).replace(/\.[^.]+$/, ''),
    });
    const embeddings = [];
    for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
      const batch = chunks.slice(start, start + BATCH_SIZE);
      embeddings.push(
        ...(await embedder.embedDocuments(batch.map((chunk) => chunkToEmbeddingText(title, chunk)))),
      );
    }

    await repo.replaceDocument({
      source,
      title,
      contentHash,
      embeddingModel: embedder.model,
      chunks: chunks.map((chunk, index) => ({ ...chunk, embedding: embeddings[index] })),
    });
    updated += 1;
    totalChunks += chunks.length;
    console.log(`  ${source}: ${chunks.length} potongan`);
  }

  // Berkas yang dihapus dari folder knowledge ikut dihapus dari database.
  const known = new Set(files);
  let removed = 0;
  for (const source of await repo.listDocumentSources()) {
    if (!known.has(source)) {
      await repo.deleteDocumentBySource(source);
      removed += 1;
      console.log(`  ${source}: dihapus`);
    }
  }

  console.log(
    `Ingest selesai: ${updated} dokumen diperbarui (${totalChunks} potongan), ${skipped} tidak berubah, ${removed} dihapus.`,
  );
} catch (error) {
  console.error('Ingest gagal:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
