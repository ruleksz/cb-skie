import { randomUUID } from 'node:crypto';

/** Pengganti repository MySQL yang menyimpan semuanya di memori. */
export function createMemoryRepo({ chunks = [] } = {}) {
  const conversations = new Map();
  const messages = [];
  let nextMessageId = 1;

  return {
    conversations,
    messages,
    async countChunks() {
      return chunks.length;
    },
    async getKnowledgeStamp() {
      return String(chunks.length);
    },
    async getAllChunks() {
      return chunks;
    },
    async keywordSearch(query, limit) {
      const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
      return chunks
        .filter((chunk) => words.some((word) => chunk.content.toLowerCase().includes(word)))
        .slice(0, limit)
        .map((chunk) => chunk.id);
    },
    async createConversation({ id, clientId, title }) {
      conversations.set(id, { id, clientId, title, updatedAt: new Date() });
      return { id, title };
    },
    async listConversations(clientId) {
      return [...conversations.values()]
        .filter((conversation) => conversation.clientId === clientId)
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
    },
    async getConversation(id, clientId) {
      const conversation = conversations.get(id);
      if (!conversation || conversation.clientId !== clientId) return null;
      return { id, title: conversation.title, updatedAt: conversation.updatedAt };
    },
    async deleteConversation(id, clientId) {
      const conversation = conversations.get(id);
      if (!conversation || conversation.clientId !== clientId) return false;
      conversations.delete(id);
      return true;
    },
    async touchConversation() {},
    async addMessage({ conversationId, role, content, sources = null }) {
      const id = nextMessageId++;
      messages.push({ id, conversationId, role, content, sources: sources ?? [], createdAt: new Date() });
      return id;
    },
    async getMessages(conversationId, { limit } = {}) {
      const all = messages.filter((message) => message.conversationId === conversationId);
      return limit ? all.slice(-limit) : all;
    },
  };
}

export function createFakeLlm({ answer = 'Jawaban uji.', configured = true, fail = false } = {}) {
  const calls = { stream: [], complete: [] };
  return {
    calls,
    provider: 'fake',
    model: 'fake-model',
    isConfigured: configured,
    missing: configured ? [] : ['LLM_API_KEY'],
    async *streamChat(messages) {
      calls.stream.push(messages);
      if (fail) {
        const error = new Error('Penyedia LLM menolak permintaan (401)');
        error.name = 'LlmError';
        throw error;
      }
      for (const word of answer.split(' ')) yield `${word} `;
    },
    async complete(messages) {
      calls.complete.push(messages);
      return 'Siapa juara M1 World Championship?';
    },
  };
}

export const testConfig = { clientOrigins: ['http://localhost:5173'], trustProxy: 0 };
export const clientId = randomUUID();

export function parseSse(text) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1];
      const data = block.match(/^data: (.+)$/m)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}
