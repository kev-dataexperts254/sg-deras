import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const CRED_FILE = path.join(DATA_DIR, 'admin-cred.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

interface StoredCredential {
  username: string;
  salt: string;
  passwordHash: string;
  updatedAt: string;
}

interface SessionPayload {
  sub: string;
  exp: number;
  nonce: string;
}

const revokedNonces = new Set<string>();

function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyHash(password: string, salt: string, expectedHashHex: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function readStoredCredential(): StoredCredential | null {
  try {
    if (!fs.existsSync(CRED_FILE)) return null;
    const raw = fs.readFileSync(CRED_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredCredential>;
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.salt === 'string' &&
      typeof parsed.passwordHash === 'string'
    ) {
      return {
        username: parsed.username,
        salt: parsed.salt,
        passwordHash: parsed.passwordHash,
        updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeStoredCredential(cred: StoredCredential): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CRED_FILE, JSON.stringify(cred, null, 2), { mode: 0o600 });
}

function getEnvCredential(): { username: string; password: string } | null {
  const envPass = process.env.ADMIN_PASSWORD;
  if (typeof envPass === 'string' && envPass.length > 0) {
    const envUser =
      typeof process.env.ADMIN_USERNAME === 'string' && process.env.ADMIN_USERNAME.trim().length > 0
        ? process.env.ADMIN_USERNAME.trim()
        : 'admin';
    return { username: envUser, password: envPass };
  }
  return null;
}

function issueToken(username: string): string {
  const payload: SessionPayload = {
    sub: username,
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.sub || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return null;
    }
    if (revokedNonces.has(payload.nonce)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }
  (req as Request & { adminSession?: SessionPayload }).adminSession = payload;
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/admin/status', (req, res) => {
    const envCred = getEnvCredential();
    const stored = readStoredCredential();
    const configured = Boolean(envCred || stored);
    const token = extractBearer(req);
    const session = token ? verifyToken(token) : null;

    res.json({
      configured,
      envOverride: Boolean(envCred),
      authenticated: Boolean(session),
      username: session ? session.sub : null,
    });
  });

  // One-time first-run admin setup when no env password or stored credential exists
  app.post('/api/admin/setup', (req, res) => {
    const envCred = getEnvCredential();
    const existing = readStoredCredential();
    if (envCred || existing) {
      res.status(409).json({ error: 'Admin account is already configured. Please sign in.' });
      return;
    }

    const { username, password } = req.body as { username?: unknown; password?: unknown };
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.trim().length < 2 ||
      username.trim().length > 64 ||
      password.length < 4 ||
      password.length > 128
    ) {
      res.status(400).json({
        error: 'Username (2–64 chars) and password (at least 4 characters) are required.',
      });
      return;
    }

    const cleanUser = username.trim();
    const { salt, hash } = hashPassword(password);
    writeStoredCredential({
      username: cleanUser,
      salt,
      passwordHash: hash,
      updatedAt: new Date().toISOString(),
    });

    const token = issueToken(cleanUser);
    res.status(201).json({
      authenticated: true,
      username: cleanUser,
      token,
      envOverride: false,
    });
  });

  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body as { username?: unknown; password?: unknown };
    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Username and password are required.' });
      return;
    }

    const cleanUser = username.trim();
    const envCred = getEnvCredential();

    if (envCred) {
      const userMatch =
        cleanUser.length === envCred.username.length &&
        crypto.timingSafeEqual(Buffer.from(cleanUser), Buffer.from(envCred.username));
      const passBuf = Buffer.from(password);
      const envPassBuf = Buffer.from(envCred.password);
      const passMatch =
        passBuf.length === envPassBuf.length && crypto.timingSafeEqual(passBuf, envPassBuf);

      if (!userMatch || !passMatch) {
        res.status(401).json({ error: 'Invalid username or password.' });
        return;
      }

      const token = issueToken(envCred.username);
      res.json({ authenticated: true, username: envCred.username, token, envOverride: true });
      return;
    }

    const stored = readStoredCredential();
    if (!stored) {
      res.status(400).json({ error: 'Admin account not set up yet.' });
      return;
    }

    const userMatch =
      cleanUser.length === stored.username.length &&
      crypto.timingSafeEqual(Buffer.from(cleanUser), Buffer.from(stored.username));
    const passMatch = verifyHash(password, stored.salt, stored.passwordHash);

    if (!userMatch || !passMatch) {
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const token = issueToken(stored.username);
    res.json({ authenticated: true, username: stored.username, token, envOverride: false });
  });

  app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
    const envCred = getEnvCredential();
    if (envCred) {
      res.status(400).json({
        error:
          'ADMIN_PASSWORD is currently managed by environment Secrets. Update ADMIN_PASSWORD in Settings -> Secrets to change it.',
      });
      return;
    }

    const stored = readStoredCredential();
    if (!stored) {
      res.status(400).json({ error: 'No admin credential record found.' });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: unknown;
      newPassword?: unknown;
    };

    if (
      typeof currentPassword !== 'string' ||
      typeof newPassword !== 'string' ||
      newPassword.length < 4 ||
      newPassword.length > 128
    ) {
      res.status(400).json({
        error: 'Current password and a new password (at least 4 characters) are required.',
      });
      return;
    }

    if (!verifyHash(currentPassword, stored.salt, stored.passwordHash)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const { salt, hash } = hashPassword(newPassword);
    writeStoredCredential({
      username: stored.username,
      salt,
      passwordHash: hash,
      updatedAt: new Date().toISOString(),
    });

    const oldSession = (req as Request & { adminSession?: SessionPayload }).adminSession;
    if (oldSession) {
      revokedNonces.add(oldSession.nonce);
    }

    const token = issueToken(stored.username);
    res.json({
      success: true,
      username: stored.username,
      token,
    });
  });

  app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
    const oldSession = (req as Request & { adminSession?: SessionPayload }).adminSession;
    if (oldSession) {
      revokedNonces.add(oldSession.nonce);
    }
    res.json({ authenticated: false });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SG Collections server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
