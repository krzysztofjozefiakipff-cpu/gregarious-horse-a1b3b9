import {createHash, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

export const sharedAdmin = 'admin@carvamo.com';
const derive = promisify(scrypt);
const lifetime = 8 * 60 * 60 * 1000;
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const random = () => randomBytes(32).toString('hex');

export function localIdentity(database, db) {
  let windowStart = 0;
  let total = 0;
  const attempts = new Map();
  function allowAttempt(email) {
    const now = Date.now();
    if (now - windowStart >= 60_000) {
      windowStart = now;
      total = 0;
      attempts.clear();
    }
    const count = attempts.get(email) ?? 0;
    if (total >= 120 || count >= 8) return false;
    total++;
    attempts.set(email, count + 1);
    return true;
  }

  return {
    allowAttempt,
    async authenticate(email, password) {
      const credential = database.prepare(`
        SELECT salt, password_hash FROM lejek_credentials
        WHERE email = ? AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email = ?)
      `).get(email, email);
      const candidate = await derive(password, credential?.salt ?? '0'.repeat(64), 64);
      const expected = Buffer.from(credential?.password_hash ?? '0'.repeat(128), 'hex');
      if (!timingSafeEqual(candidate, expected) || !credential) return null;
      const token = random();
      const now = Date.now();
      database.prepare('DELETE FROM lejek_sessions WHERE expires_at <= ?').run(now);
      const result = database.prepare(`
        INSERT INTO lejek_sessions (token_hash, email, expires_at)
        SELECT ?, email, ? FROM lejek_credentials
        WHERE email = ? AND password_hash = ?
          AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email = ?)
      `).run(tokenHash(token), now + lifetime, email, credential.password_hash, email);
      return result.changes ? 'bw-' + token : null;
    },
    account(token) {
      return database.prepare(`
        SELECT accounts.id, accounts.email FROM lejek_sessions
        JOIN accounts USING (email)
        WHERE token_hash = ? AND expires_at > ?
          AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email = accounts.email)
      `).get(tokenHash(token), Date.now());
    },
    logout(token) {
      database.prepare('DELETE FROM lejek_sessions WHERE token_hash = ?').run(tokenHash(token));
    },
    async passwordStatements(email, password) {
      const salt = random();
      const hash = (await derive(password, salt, 64)).toString('hex');
      return [
        db.prepare(`INSERT INTO lejek_credentials (email, salt, password_hash) VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET salt=excluded.salt, password_hash=excluded.password_hash`).bind(email, salt, hash),
        db.prepare('DELETE FROM lejek_sessions WHERE email = ?').bind(email)
      ];
    }
  };
}
