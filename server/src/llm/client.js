export class LlmError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'LlmError';
    this.status = status;
  }
}

/** Membaca aliran SSE dari API Chat Completions dan menghasilkan potongan teks. */
export async function* parseChatStream(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const part of body) {
    buffer += decoder.decode(part, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') return;
      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        continue;
      }
      const text = payload.choices?.[0]?.delta?.content;
      if (text) yield text;
    }
  }
}

/** Klien untuk API apa pun yang kompatibel dengan OpenAI Chat Completions. */
export function createLlmClient({ provider, apiKey, model, baseUrl }, { fetchImpl = fetch } = {}) {
  const missing = [];
  if (!baseUrl) missing.push('LLM_BASE_URL');
  if (!model) missing.push('LLM_MODEL');
  if (!apiKey && provider !== 'custom') missing.push('LLM_API_KEY');

  async function request(messages, { stream, signal, temperature = 0.3 }) {
    if (missing.length > 0) {
      throw new LlmError(`LLM belum dikonfigurasi. Isi ${missing.join(', ')} di berkas .env.`);
    }
    const response = await fetchImpl(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, temperature, stream }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      throw new LlmError(`Penyedia LLM menolak permintaan (${response.status}): ${detail}`, {
        status: response.status,
      });
    }
    return response;
  }

  return {
    provider,
    model,
    isConfigured: missing.length === 0,
    missing,

    async *streamChat(messages, options = {}) {
      const response = await request(messages, { ...options, stream: true });
      yield* parseChatStream(response.body);
    },

    async complete(messages, options = {}) {
      const response = await request(messages, { ...options, stream: false });
      const payload = await response.json();
      return payload.choices?.[0]?.message?.content?.trim() ?? '';
    },
  };
}
