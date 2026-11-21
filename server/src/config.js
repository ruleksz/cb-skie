import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(here, '..');
export const repoRoot = path.resolve(serverRoot, '..');

dotenv.config({ path: [path.join(repoRoot, '.env'), path.join(serverRoot, '.env')], quiet: true });

const LLM_PRESETS = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-4-hydrogen',
  },
  openai: { baseUrl: 'https://api.openai.com/v1', model: '' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: '' },
  custom: { baseUrl: '', model: '' },
};

function number(value, fallback) {
  const parsed = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const provider = (env.LLM_PROVIDER || 'gemini').toLowerCase();
  const preset = LLM_PRESETS[provider];
  if (!preset) {
    throw new Error(
      `LLM_PROVIDER "${provider}" tidak dikenal. Pilihan: ${Object.keys(LLM_PRESETS).join(', ')}`,
    );
  }

  return {
    port: number(env.PORT, 3001),
    clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    trustProxy: number(env.TRUST_PROXY, 0),
    db: {
      host: env.DB_HOST || '127.0.0.1',
      port: number(env.DB_PORT, 3306),
      user: env.DB_USER || 'esports',
      password: env.DB_PASSWORD ?? 'esports',
      database: env.DB_NAME || 'esports_chatbot',
    },
    llm: {
      provider,
      apiKey: env.LLM_API_KEY || '',
      model: env.LLM_MODEL || preset.model,
      baseUrl: (env.LLM_BASE_URL || preset.baseUrl).replace(/\/+$/, ''),
    },
    embedding: {
      provider: (env.EMBEDDING_PROVIDER || 'local').toLowerCase(),
      model: env.EMBEDDING_MODEL || 'Xenova/multilingual-e5-small',
      baseUrl: (env.EMBEDDING_BASE_URL || '').replace(/\/+$/, ''),
      apiKey: env.EMBEDDING_API_KEY || '',
    },
    rag: {
      topK: number(env.RAG_TOP_K, 5),
      minScore: number(env.RAG_MIN_SCORE, 0.81),
    },
  };
}
