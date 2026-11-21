import {createHash, randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

export const sharedAdmin = 'admin@carvamo.com';
const derive = promisify(scrypt);
const sessionSeconds = 8 * 60 * 60;
const rememberedSessionSeconds = 30 * 24 * 60 * 60;
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

  function credentialFor(email) {
    return database.prepare(`
      SELECT salt,password_hash FROM lejek_credentials
      WHERE email=? AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=?)
    `).get(email,email);
  }
  async function verify(email,password) {
    const credential=credentialFor(email);
    const candidate=await derive(password,credential?.salt??'0'.repeat(64),64);
    const expected=Buffer.from(credential?.password_hash??'0'.repeat(128),'hex');
    return timingSafeEqual(candidate,expected)?credential:null;
  }
  async function replacePassword(email,credentialHash,password,resetToken=null) {
    const salt=random();
    const hash=(await derive(password,salt,64)).toString('hex');
    database.exec('BEGIN IMMEDIATE');
    try {
      const tokenValid=!resetToken||database.prepare(`
        SELECT 1 FROM lejek_password_resets WHERE token_hash=? AND email=? AND expires_at>?
      `).get(resetToken,email,Date.now());
      const current=credentialFor(email);
      if (!tokenValid||current?.password_hash!==credentialHash) {
        database.exec('ROLLBACK');
        return false;
      }
      database.prepare('UPDATE lejek_credentials SET salt=?,password_hash=? WHERE email=?').run(salt,hash,email);
      database.prepare('DELETE FROM lejek_sessions WHERE email=?').run(email);
      database.prepare('DELETE FROM lejek_password_resets WHERE email=?').run(email);
      database.exec('COMMIT');
      return true;
    } catch(error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  return {
    allowAttempt,
    async changePassword(email,oldPassword,newPassword) {
      const current=await verify(email,oldPassword);
      return Boolean(current&&await replacePassword(email,current.password_hash,newPassword));
    },
    issueReset(email, validFor=20*60_000) {
      database.prepare(`INSERT INTO lejek_credentials (email,salt,password_hash)
        SELECT email,?,? FROM accounts WHERE email=?
        AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email=?)
        ON CONFLICT(email) DO NOTHING`).run(random(),randomBytes(64).toString('hex'),email,email);
      const current=credentialFor(email);
      if (!current) return null;
      const token=random();
      const now=Date.now();
      database.prepare('DELETE FROM lejek_password_resets WHERE expires_at<=?').run(now);
      const result=database.prepare(`INSERT INTO lejek_password_resets VALUES (?,?,?,?)
        ON CONFLICT(email) DO UPDATE SET token_hash=excluded.token_hash,credential_hash=excluded.credential_hash,
          expires_at=excluded.expires_at WHERE lejek_password_resets.expires_at<=?`)
        .run(tokenHash(token),email,current.password_hash,now+validFor,now+validFor-2*60_000);
      return result.changes?token:null;
    },
    discardReset(token) {
      database.prepare("DELETE FROM lejek_password_resets WHERE token_hash=?").run(tokenHash(token));
    },
    resetPassword(token,password) {
      const key=tokenHash(token);
      const reset=database.prepare('SELECT email,credential_hash FROM lejek_password_resets WHERE token_hash=? AND expires_at>?').get(key,Date.now());
      return reset?replacePassword(reset.email,reset.credential_hash,password,key):false;
    },
    async authenticate(email, password, remember = false) {
      const credential=await verify(email,password);
      if (!credential) return null;
      const token = random();
      const now = Date.now();
      const maxAge = remember ? rememberedSessionSeconds : sessionSeconds;
      database.prepare('DELETE FROM lejek_sessions WHERE expires_at <= ?').run(now);
      const result = database.prepare(`
        INSERT INTO lejek_sessions (token_hash, email, expires_at)
        SELECT ?, email, ? FROM lejek_credentials
        WHERE email = ? AND password_hash = ?
          AND NOT EXISTS (SELECT 1 FROM archived_users WHERE email = ?)
      `).run(tokenHash(token), now + maxAge * 1000, email, credential.password_hash, email);
      return result.changes ? {token:'bw-' + token,maxAge} : null;
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
        db.prepare('DELETE FROM lejek_sessions WHERE email = ?').bind(email),
        db.prepare('DELETE FROM lejek_password_resets WHERE email = ?').bind(email)
      ];
    }
  };
}
