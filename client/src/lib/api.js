import { readSse } from './sse.js';

const CLIENT_ID_KEY = 'skie.clientId';
const BASE = import.meta.env.VITE_API_BASE ?? '';
let memoryClientId;

function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    memoryClientId ??= crypto.randomUUID();
    return memoryClientId;
  }
}

async function request(path, { headers, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { 'X-Client-Id': getClientId(), ...headers },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.', { cause: error });
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const fallback =
      response.status === 429
        ? 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
        : `Permintaan gagal (${response.status}).`;
    throw new Error(body?.error ?? fallback);
  }
  return response;
}

export async function getHealth() {
  return (await request('/api/health')).json();
}

export async function listConversations() {
  return (await (await request('/api/conversations')).json()).conversations;
}

export async function getConversation(id, { signal } = {}) {
  return (await request(`/api/conversations/${id}`, { signal })).json();
}

export async function deleteConversation(id) {
  await request(`/api/conversations/${id}`, { method: 'DELETE' });
}

/** Mengirim pesan dan menghasilkan event SSE: meta, token, error, done. */
export async function* streamChat({ message, conversationId, retry = false, signal }) {
  const response = await request('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      message,
      conversationId: conversationId ?? undefined,
      retry: (retry && Boolean(conversationId)) || undefined,
    }),
    signal,
  });
  yield* readSse(response.body);
}
