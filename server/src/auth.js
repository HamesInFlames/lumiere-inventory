import crypto from 'node:crypto';
import { config } from './config.js';

// Session token = HMAC of a constant marker with the app password. Rotating the
// password invalidates all sessions. Good enough for a single shared staff
// login; swap for per-user auth later without touching the rest of the app.
const TOKEN = crypto
  .createHmac('sha256', config.appPassword)
  .update('lumiere-session-v1')
  .digest('hex');

const COOKIE = 'lumiere_session';

export function issueCookie(reply) {
  reply.setCookie(COOKIE, TOKEN, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function checkPassword(password) {
  const a = Buffer.from(String(password || ''));
  const b = Buffer.from(config.appPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAuthed(request) {
  return request.cookies?.[COOKIE] === TOKEN;
}

/** Fastify preHandler that rejects unauthenticated API calls. */
export function requireAuth(request, reply, done) {
  if (isAuthed(request)) return done();
  reply.code(401).send({ error: 'unauthorized' });
}
