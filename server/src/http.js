const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

/** Tanpa login: tiap browser mengirim id acak yang memisahkan riwayat percakapannya. */
export function requireClientId(req, res, next) {
  const clientId = req.get('x-client-id');
  if (!isUuid(clientId)) {
    res.status(400).json({ error: 'Header X-Client-Id wajib berupa UUID.' });
    return;
  }
  req.clientId = clientId.toLowerCase();
  next();
}
