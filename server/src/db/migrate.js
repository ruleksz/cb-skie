import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from '../config.js';
import { createPool } from './pool.js';

const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export async function migrate(pool) {
  const schema = await fs.readFile(schemaPath, 'utf8');
  const statements = schema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await pool.query(statement);
  }
  return statements.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const pool = createPool(loadConfig().db);
  try {
    const count = await migrate(pool);
    console.log(`Migrasi selesai (${count} tabel diperiksa).`);
  } catch (error) {
    console.error('Migrasi gagal:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
