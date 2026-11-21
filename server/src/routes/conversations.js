import { Router } from 'express';
import { isUuid, requireClientId } from '../http.js';

export function conversationsRouter({ repo }) {
  const router = Router();
  router.use(requireClientId);

  router.get('/', async (req, res) => {
    res.json({ conversations: await repo.listConversations(req.clientId) });
  });

  router.get('/:id', async (req, res) => {
    const conversation = isUuid(req.params.id)
      ? await repo.getConversation(req.params.id, req.clientId)
      : null;
    if (!conversation) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    const messages = await repo.getMessages(conversation.id);
    res.json({ conversation, messages });
  });

  router.delete('/:id', async (req, res) => {
    const deleted = isUuid(req.params.id)
      ? await repo.deleteConversation(req.params.id, req.clientId)
      : false;
    if (!deleted) {
      res.status(404).json({ error: 'Percakapan tidak ditemukan.' });
      return;
    }
    res.status(204).end();
  });

  return router;
}
