const http = require('http');

function startHealthServer(client, controlApi = null) {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer(async (req, res) => {
    try {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        ok: true,
        connected: Boolean(client.user?.id),
        setupRequired: !client.user?.id,
        bot: client.user?.tag || 'KIXO setup pending',
        uptime: Math.floor(process.uptime()),
        version: '8.36.0'
      }));
      return;
    }
    if (controlApi && String(req.url || '').startsWith('/control')) {
      if (await controlApi(req, res)) return;
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      console.error('HTTP control route error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      }
      if (!res.writableEnded) res.end(JSON.stringify({ error: 'Control route unavailable' }));
    }
  });
  server.listen(port, '0.0.0.0', () => console.log(`KIXO health server listening on :${port}`));
  return server;
}

module.exports = { startHealthServer };
