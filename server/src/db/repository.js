function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

export function createRepository(pool) {
  return {
    async ping() {
      await pool.query('SELECT 1');
    },

    // ---- Basis pengetahuan ----

    async getDocumentBySource(source) {
      const [rows] = await pool.query(
        'SELECT id, source, title, content_hash AS contentHash, embedding_model AS embeddingModel FROM documents WHERE source = ?',
        [source],
      );
      return rows[0] ?? null;
    },

    async listDocumentSources() {
      const [rows] = await pool.query('SELECT source FROM documents');
      return rows.map((row) => row.source);
    },

    async replaceDocument({ source, title, contentHash, embeddingModel, chunks }) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query('DELETE FROM documents WHERE source = ?', [source]);
        const [result] = await connection.query(
          'INSERT INTO documents (source, title, content_hash, embedding_model) VALUES (?, ?, ?, ?)',
          [source, title, contentHash, embeddingModel],
        );
        const documentId = result.insertId;
        if (chunks.length > 0) {
          await connection.query(
            'INSERT INTO chunks (document_id, chunk_index, heading, content, embedding) VALUES ?',
            [
              chunks.map((chunk, index) => [
                documentId,
                index,
                chunk.heading,
                chunk.content,
                JSON.stringify(chunk.embedding),
              ]),
            ],
          );
        }
        await connection.commit();
        return documentId;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async deleteDocumentBySource(source) {
      await pool.query('DELETE FROM documents WHERE source = ?', [source]);
    },

    // Berubah setiap kali isi basis pengetahuan berubah; dipakai untuk membatalkan cache.
    async getKnowledgeStamp() {
      const [rows] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM chunks) AS chunkCount,
                (SELECT COALESCE(MAX(id), 0) FROM chunks) AS maxChunkId`,
      );
      return `${rows[0].chunkCount}:${rows[0].maxChunkId}`;
    },

    async countChunks() {
      const [rows] = await pool.query('SELECT COUNT(*) AS total FROM chunks');
      return Number(rows[0].total);
    },

    async getAllChunks() {
      const [rows] = await pool.query(
        `SELECT c.id, c.heading, c.content, c.embedding, d.title, d.source
           FROM chunks c
           JOIN documents d ON d.id = c.document_id
          ORDER BY c.document_id, c.chunk_index`,
      );
      return rows.map((row) => ({ ...row, embedding: parseJson(row.embedding) }));
    },

    async keywordSearch(query, limit) {
      const [rows] = await pool.query(
        `SELECT id, MATCH(heading, content) AGAINST (? IN NATURAL LANGUAGE MODE) AS relevance
           FROM chunks
          WHERE MATCH(heading, content) AGAINST (? IN NATURAL LANGUAGE MODE)
          ORDER BY relevance DESC
          LIMIT ?`,
        [query, query, limit],
      );
      return rows.map((row) => row.id);
    },

    // ---- Percakapan ----

    async createConversation({ id, clientId, title }) {
      await pool.query('INSERT INTO conversations (id, client_id, title) VALUES (?, ?, ?)', [
        id,
        clientId,
        title,
      ]);
      return { id, title };
    },

    async listConversations(clientId) {
      const [rows] = await pool.query(
        `SELECT id, title, updated_at AS updatedAt
           FROM conversations
          WHERE client_id = ?
          ORDER BY updated_at DESC
          LIMIT 100`,
        [clientId],
      );
      return rows;
    },

    async getConversation(id, clientId) {
      const [rows] = await pool.query(
        'SELECT id, title, updated_at AS updatedAt FROM conversations WHERE id = ? AND client_id = ?',
        [id, clientId],
      );
      return rows[0] ?? null;
    },

    async deleteConversation(id, clientId) {
      const [result] = await pool.query(
        'DELETE FROM conversations WHERE id = ? AND client_id = ?',
        [id, clientId],
      );
      return result.affectedRows > 0;
    },

    async touchConversation(id) {
      await pool.query('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    },

    async addMessage({ conversationId, role, content, sources = null }) {
      const [result] = await pool.query(
        'INSERT INTO messages (conversation_id, role, content, sources) VALUES (?, ?, ?, ?)',
        [conversationId, role, content, sources ? JSON.stringify(sources) : null],
      );
      return result.insertId;
    },

    /** Menghapus pertanyaan terakhir (dan jawaban sesudahnya) bila isinya sama dengan `content`. */
    async deleteLastTurn(conversationId, content) {
      const [[last]] = await pool.query(
        `SELECT id, content FROM messages
          WHERE conversation_id = ? AND role = 'user' ORDER BY id DESC LIMIT 1`,
        [conversationId],
      );
      if (!last || last.content !== content) return false;
      await pool.query('DELETE FROM messages WHERE conversation_id = ? AND id >= ?', [conversationId, last.id]);
      return true;
    },

    async getMessages(conversationId, { limit } = {}) {
      const [rows] = limit
        ? await pool.query(
            `SELECT * FROM (
               SELECT id, role, content, sources, created_at AS createdAt
                 FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?
             ) recent ORDER BY id ASC`,
            [conversationId, limit],
          )
        : await pool.query(
            `SELECT id, role, content, sources, created_at AS createdAt
               FROM messages WHERE conversation_id = ? ORDER BY id ASC`,
            [conversationId],
          );
      return rows.map((row) => ({ ...row, sources: parseJson(row.sources) ?? [] }));
    },
  };
}
