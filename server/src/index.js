import fs from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { config } from './config.js';
import { store } from './store.js';
import { issueCookie, checkPassword, isAuthed, requireAuth } from './auth.js';

const app = Fastify({ logger: { level: 'info' } });
await app.register(cookie);

// ---- Auth ----
app.post('/api/login', async (request, reply) => {
  const { password } = request.body || {};
  if (!checkPassword(password)) {
    return reply.code(401).send({ error: 'invalid password' });
  }
  issueCookie(reply);
  return { ok: true };
});

app.get('/api/session', async (request) => ({ authed: isAuthed(request) }));

// ---- Inventory API (auth required) ----
app.get('/api/items', { preHandler: requireAuth }, async () => ({
  items: store.getItems(),
  units: store.getUnits(),
  notes: store.getNotes(),
  lastSync: store.getLastSync(),
  mode: config.mode,
}));

app.get('/api/units', { preHandler: requireAuth }, async () => ({ units: store.getUnits() }));

app.patch('/api/items/:id', { preHandler: requireAuth }, async (request, reply) => {
  const { id } = request.params;
  const { quantity, unit, lowThreshold, updatedBy } = request.body || {};
  const patch = {};
  if (quantity !== undefined) patch.quantity = Number(quantity);
  if (unit !== undefined) patch.unit = String(unit);
  if (lowThreshold !== undefined) patch.lowThreshold = Number(lowThreshold);
  if (Object.keys(patch).length === 0) {
    return reply.code(400).send({ error: 'no updatable fields provided' });
  }
  const updated = await store.updateItem(id, patch, updatedBy);
  if (!updated) return reply.code(404).send({ error: 'item not found' });
  return { item: updated };
});

// ---- Notes (auth required) ----
app.post('/api/notes', { preHandler: requireAuth }, async (request, reply) => {
  const { text, by } = request.body || {};
  const trimmed = String(text || '').trim().slice(0, 500);
  if (!trimmed) return reply.code(400).send({ error: 'note text required' });
  const note = await store.addNote(trimmed, by);
  return { note };
});

app.delete('/api/notes/:id', { preHandler: requireAuth }, async (request, reply) => {
  const ok = await store.deleteNote(request.params.id);
  if (!ok) return reply.code(404).send({ error: 'note not found' });
  return { ok: true };
});

// ---- Server-Sent Events: live updates to all connected clients ----
app.get('/api/stream', { preHandler: requireAuth }, (request, reply) => {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  reply.raw.write(`event: hello\ndata: ${JSON.stringify({ lastSync: store.getLastSync() })}\n\n`);

  const send = (event) => {
    reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
  const unsubscribe = store.subscribe(send);

  // Heartbeat keeps proxies from closing an idle connection.
  const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 25_000);

  request.raw.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ---- Apps Script webhook: sheet edited by a human -> refresh + broadcast ----
app.post('/webhook/sheet-changed', async (request, reply) => {
  const provided = request.headers['x-webhook-secret'] || request.body?.secret;
  if (provided !== config.webhookSecret) {
    return reply.code(403).send({ error: 'forbidden' });
  }
  await store.refresh();
  return { ok: true };
});

app.get('/health', async () => ({ ok: true, mode: config.mode, lastSync: store.getLastSync() }));

// ---- Static frontend (built) ----
if (fs.existsSync(config.webDist)) {
  await app.register(fastifyStatic, { root: config.webDist });
  // SPA fallback for client-side routes.
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.url.startsWith('/api') || request.raw.url.startsWith('/webhook')) {
      return reply.code(404).send({ error: 'not found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(`Web build not found at ${config.webDist}. Run "npm run build".`);
}

await store.start();
app.log.info(`Inventory store started in "${config.mode}" mode`);

try {
  await app.listen({ port: config.port, host: config.host });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const shutdown = () => { store.stop(); app.close().then(() => process.exit(0)); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
