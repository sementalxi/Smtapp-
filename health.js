const http = require('http');
const { createWebAdminHandler } = require('./webadmin');
const { createControlApi } = require('./controlapi');

function startHealthServer(client, store, rulesStore) {
  const port = Number(process.env.PORT || 3000);
  const webAdmin = createWebAdminHandler(client, store);
  const controlApi = createControlApi(client, store, rulesStore);
  const server = http.createServer(async (req, res) => {
    try {
      const controlled = await controlApi(req, res);
      if (controlled !== false) return;
      const handled = await webAdmin(req, res);
      if (handled !== false) return;
    } catch (err) {
      console.error('Web server error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
      return;
    }
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, bot: client.user?.tag || 'starting', uptime: Math.floor(process.uptime()), admin: '/admin' }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  server.listen(port, '0.0.0.0', () => console.log(`SEMENTAL web dashboard + health server listening on :${port}`));
  return server;
}

module.exports = { startHealthServer };
