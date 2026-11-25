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

// Auth is intentionally DISABLED — the app is public (no staff password), per
// the owner's decision. To re-enable a shared login later, restore the two
// functions below to use the cookie/TOKEN check (git history has the original)
// and the frontend login flow comes back automatically via /api/session.
export function isAuthed() {
  return true;
}

/** Fastify preHandler. Auth disabled: every request is allowed through. */
export function requireAuth(request, reply, done) {
  done();
}
