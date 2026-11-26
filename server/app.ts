import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express, { NextFunction, Request, Response } from 'express';
import {
  createOrder,
  deleteCategoryById,
  deleteProductById,
  getStoredAdminCredFromDb,
  listOrders,
  saveStoredAdminCredToDb,
  seedCatalogIfEmpty,
  StoredAdminCredential,
  updateOrderStatusById,
  updateProductStock,
  upsertCategory,
  upsertProduct,
  upsertStarterCatalog,
} from '../src/db/storeRepo.ts';
import { AuthRequest, requireAuth } from '../src/middleware/auth.ts';
import type {
  DeliveryMethod,
  OrderItemSnapshot,
  OrderStatus,
} from '../src/types.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Dispatched',
  'Delivered',
  'Cancelled',
];
const PROTECTED_CATEGORY_IDS = new Set(['sg-deras', 'sg-kids-coset', 'mutumba-bales']);

interface SessionPayload {
  sub: string;
  exp: number;
  nonce: string;
}

const revokedNonces = new Set<string>();
let memoryCredential: StoredAdminCredential | null = null;

function getLegacyCredentialFilePath(): string {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'sg-wholesalers-data', 'admin-cred.json');
  }
  return path.resolve(process.cwd(), '.data', 'admin-cred.json');
}

function readLegacyFileCredential(): StoredAdminCredential | null {
  try {
    const credFile = getLegacyCredentialFilePath();
    if (!fs.existsSync(credFile)) return null;
    const raw = fs.readFileSync(credFile, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredAdminCredential>;
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

async function readStoredCredential(): Promise<StoredAdminCredential | null> {
  if (memoryCredential) return memoryCredential;
  try {
    const dbCred = await getStoredAdminCredFromDb();
    if (dbCred) {
      memoryCredential = dbCred;
      return dbCred;
    }
  } catch (err) {
    console.error('Could not query admin credential from PostgreSQL:', err);
  }

  const legacy = readLegacyFileCredential();
  if (legacy) {
    memoryCredential = legacy;
    try {
      await saveStoredAdminCredToDb(legacy);
    } catch {
      // Non-fatal if DB sync happens on next call
    }
    return legacy;
  }
  return null;
}

async function writeStoredCredential(cred: StoredAdminCredential): Promise<void> {
  memoryCredential = cred;
  await saveStoredAdminCredToDb(cred);
}

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

function isSafeImageUrlServer(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/src/assets/')) {
    return trimmed.length <= 512;
  }
  if (
    trimmed.startsWith('data:image/jpeg;base64,') ||
    trimmed.startsWith('data:image/png;base64,') ||
    trimmed.startsWith('data:image/webp;base64,')
  ) {
    return trimmed.length <= 350000;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function sanitizeId(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || `item-${Date.now()}`;
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  // ==========================================
  // Public Storefront & Order Endpoints
  // ==========================================

  app.get('/api/store/bootstrap', async (_req, res) => {
    try {
      const data = await seedCatalogIfEmpty();
      res.json({
        categories: data.categories,
        products: data.products,
      });
    } catch (error) {
      console.error('Failed to bootstrap store from PostgreSQL:', error);
      res.status(500).json({ error: 'Failed to load store catalog.' });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const body = req.body as {
        id?: unknown;
        orderNumber?: unknown;
        customerName?: unknown;
        customerPhone?: unknown;
        deliveryLocation?: unknown;
        notes?: unknown;
        deliveryMethod?: unknown;
        items?: unknown;
        totalAmount?: unknown;
      };

      const deliveryMethod: DeliveryMethod =
        body.deliveryMethod === 'golink_nairobi' ? 'golink_nairobi' : 'whatsapp_standard';

      if (!Array.isArray(body.items) || body.items.length === 0) {
        res.status(400).json({ error: 'Order must contain at least one item.' });
        return;
      }

      const cleanItems: OrderItemSnapshot[] = [];
      let computedTotal = 0;

      for (const raw of body.items.slice(0, 50)) {
        if (!raw || typeof raw !== 'object') continue;
        const item = raw as Record<string, unknown>;
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          continue;
        }
        const safeUnit = Math.round(unitPrice);
        const lineTotal = safeUnit * quantity;
        computedTotal += lineTotal;
        cleanItems.push({
          productId: String(item.productId || 'item').slice(0, 64),
          name: String(item.name || 'Item').slice(0, 120),
          category: String(item.category || 'SG Wholesalers').slice(0, 60),
          variant: String(item.variant || 'Standard').slice(0, 60),
          quantity,
          unitPrice: safeUnit,
          lineTotal,
        });
      }

      if (cleanItems.length === 0) {
        res.status(400).json({ error: 'No valid order items provided.' });
        return;
      }

      const orderNumber =
        typeof body.orderNumber === 'string' && body.orderNumber.trim()
          ? body.orderNumber.trim().slice(0, 32)
          : `SG-${Date.now().toString().slice(-6)}`;
      const orderId =
        typeof body.id === 'string' && body.id.trim()
          ? sanitizeId(body.id)
          : sanitizeId(`${orderNumber}-${Date.now()}`);

      const customerName =
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim().slice(0, 100)
          : 'WhatsApp Shopper';
      const customerPhone =
        typeof body.customerPhone === 'string' && body.customerPhone.trim().length >= 7
          ? body.customerPhone.trim().slice(0, 30)
          : 'Via WhatsApp';
      const deliveryLocation =
        typeof body.deliveryLocation === 'string' && body.deliveryLocation.trim()
          ? body.deliveryLocation.trim().slice(0, 200)
          : deliveryMethod === 'golink_nairobi'
            ? 'Nairobi Doorstep (Confirm estate)'
            : 'To be confirmed';
      const notes =
        typeof body.notes === 'string' ? body.notes.trim().slice(0, 400) : '';

      const order = await createOrder({
        id: orderId,
        orderNumber,
        customerName,
        customerPhone,
        deliveryLocation,
        notes,
        deliveryMethod,
        items: cleanItems,
        totalAmount: computedTotal,
      });

      res.status(201).json({ order });
    } catch (error) {
      console.error('Failed to record order:', error);
      res.status(500).json({ error: 'Unable to record order.' });
    }
  });

  // ==========================================
  // Firebase Auth User Sync Endpoint (Cloud SQL Step 4)
  // ==========================================

  app.post('/api/auth/sync', requireAuth, (req: AuthRequest, res) => {
    res.json({
      synced: true,
      uid: req.user?.uid || null,
      email: req.user?.email || null,
    });
  });

  // ==========================================
  // Admin Auth Endpoints
  // ==========================================

  app.get('/api/admin/status', async (req, res) => {
    try {
      const envCred = getEnvCredential();
      const stored = await readStoredCredential();
      const configured = Boolean(envCred || stored);
      const token = extractBearer(req);
      const session = token ? verifyToken(token) : null;

      res.json({
        configured,
        envOverride: Boolean(envCred),
        authenticated: Boolean(session),
        username: session ? session.sub : null,
      });
    } catch (error) {
      console.error('Admin status error:', error);
      res.status(500).json({ error: 'Unable to verify admin status.' });
    }
  });

  app.post('/api/admin/setup', async (req, res) => {
    try {
      const envCred = getEnvCredential();
      const existing = await readStoredCredential();
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
      await writeStoredCredential({
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
    } catch (error) {
      console.error('Admin setup error:', error);
      res.status(500).json({ error: 'Unable to save admin account.' });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
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

      const stored = await readStoredCredential();
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
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ error: 'Unable to complete sign-in.' });
    }
  });

  app.post('/api/admin/change-password', requireAdminAuth, async (req, res) => {
    try {
      const envCred = getEnvCredential();
      if (envCred) {
        res.status(400).json({
          error:
            'ADMIN_PASSWORD is set in environment variables. Update ADMIN_PASSWORD in your hosting dashboard to change it.',
        });
        return;
      }

      const stored = await readStoredCredential();
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
      await writeStoredCredential({
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
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Unable to update admin password.' });
    }
  });

  app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
    const oldSession = (req as Request & { adminSession?: SessionPayload }).adminSession;
    if (oldSession) {
      revokedNonces.add(oldSession.nonce);
    }
    res.json({ authenticated: false });
  });

  // ==========================================
  // Admin Store Management Endpoints (PostgreSQL)
  // ==========================================

  app.post('/api/admin/seed', requireAdminAuth, async (_req, res) => {
    try {
      const data = await upsertStarterCatalog();
      res.json(data);
    } catch (error) {
      console.error('Failed to seed starter catalog:', error);
      res.status(500).json({ error: 'Failed to seed starter catalog.' });
    }
  });

  app.post('/api/admin/products', requireAdminAuth, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const category = typeof body.category === 'string' ? body.category.trim() : '';
      const description = typeof body.description === 'string' ? body.description.trim() : '';
      const price = Number(body.price);
      const salePrice = body.salePrice ? Number(body.salePrice) : 0;
      const stock = Number(body.stock);
      const rawImages = Array.isArray(body.images) ? body.images : [];
      const rawVariants = Array.isArray(body.variants) ? body.variants : [];

      if (name.length < 2) {
        res.status(400).json({ error: 'Product name must be at least 2 characters.' });
        return;
      }
      if (category.length < 2) {
        res.status(400).json({ error: 'Category is required.' });
        return;
      }
      if (description.length < 4) {
        res.status(400).json({ error: 'Please provide a product description.' });
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        res.status(400).json({ error: 'Regular price must be greater than KSh 0.' });
        return;
      }
      if (!Number.isFinite(salePrice) || salePrice < 0 || (salePrice > 0 && salePrice >= price)) {
        res.status(400).json({
          error: 'Sale price must be lower than the regular price (or 0 for no discount).',
        });
        return;
      }
      if (!Number.isInteger(stock) || stock < 0) {
        res.status(400).json({ error: 'Stock must be 0 or a positive whole number.' });
        return;
      }

      const images = rawImages
        .filter((img): img is string => typeof img === 'string' && isSafeImageUrlServer(img))
        .slice(0, 4);
      if (images.length === 0) {
        res.status(400).json({ error: 'At least 1 valid product photo is required.' });
        return;
      }

      const variants = rawVariants
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim().slice(0, 60))
        .slice(0, 12);
      if (variants.length === 0) {
        res.status(400).json({ error: 'At least 1 size or variant is required.' });
        return;
      }

      const id =
        typeof body.id === 'string' && body.id.trim()
          ? sanitizeId(body.id)
          : sanitizeId(`${name}-${Date.now().toString().slice(-4)}`);

      const product = await upsertProduct({
        id,
        name: name.slice(0, 120),
        category: category.slice(0, 60),
        description: description.slice(0, 2000),
        price: Math.round(price),
        salePrice: Math.round(salePrice),
        stock,
        images,
        variants,
        isNewArrival: Boolean(body.isNewArrival),
        isBestSeller: Boolean(body.isBestSeller),
        active: body.active !== false,
      });

      res.json({ product });
    } catch (error) {
      console.error('Failed to save product:', error);
      res.status(500).json({ error: 'Unable to save product.' });
    }
  });

  app.patch('/api/admin/products/:id/stock', requireAdminAuth, async (req, res) => {
    try {
      const id = sanitizeId(req.params.id || '');
      const nextStock = Number((req.body as { stock?: unknown }).stock);
      if (!Number.isInteger(nextStock) || nextStock < 0) {
        res.status(400).json({ error: 'Stock must be 0 or a positive whole number.' });
        return;
      }
      const product = await updateProductStock(id, nextStock);
      if (!product) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      res.json({ product });
    } catch (error) {
      console.error('Failed to update stock:', error);
      res.status(500).json({ error: 'Unable to update stock.' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = sanitizeId(req.params.id || '');
      const deleted = await deleteProductById(id);
      if (!deleted) {
        res.status(404).json({ error: 'Product not found.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch (error) {
      console.error('Failed to delete product:', error);
      res.status(500).json({ error: 'Unable to delete product.' });
    }
  });

  app.post('/api/admin/categories', requireAdminAuth, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (name.length < 2) {
        res.status(400).json({ error: 'Category name must be at least 2 characters.' });
        return;
      }

      const id =
        typeof body.id === 'string' && body.id.trim()
          ? sanitizeId(body.id)
          : sanitizeId(name);
      const rawImage = typeof body.image === 'string' ? body.image.trim() : '';
      const image = isSafeImageUrlServer(rawImage)
        ? rawImage
        : '/src/assets/images/product_dera_crimson_1795635218722.jpg';

      const sortOrderNum = Number(body.sortOrder);
      const sortOrder = Number.isInteger(sortOrderNum) && sortOrderNum >= 0 ? sortOrderNum : 10;

      const category = await upsertCategory({
        id,
        name: name.slice(0, 60),
        description:
          typeof body.description === 'string' ? body.description.trim().slice(0, 400) : '',
        image,
        sortOrder,
        active: body.active !== false,
      });

      res.json({ category });
    } catch (error) {
      console.error('Failed to save category:', error);
      res.status(500).json({ error: 'Unable to save category.' });
    }
  });

  app.delete('/api/admin/categories/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = sanitizeId(req.params.id || '');
      if (PROTECTED_CATEGORY_IDS.has(id)) {
        res.status(400).json({ error: 'Core store categories cannot be deleted.' });
        return;
      }
      const deleted = await deleteCategoryById(id);
      if (!deleted) {
        res.status(404).json({ error: 'Category not found.' });
        return;
      }
      res.json({ deleted: true, id });
    } catch (error) {
      console.error('Failed to delete category:', error);
      res.status(500).json({ error: 'Unable to delete category.' });
    }
  });

  app.get('/api/admin/orders', requireAdminAuth, async (_req, res) => {
    try {
      const list = await listOrders();
      res.json({ orders: list });
    } catch (error) {
      console.error('Failed to list orders:', error);
      res.status(500).json({ error: 'Unable to load customer orders.' });
    }
  });

  app.patch('/api/admin/orders/:id', requireAdminAuth, async (req, res) => {
    try {
      const id = sanitizeId(req.params.id || '');
      const status = (req.body as { status?: unknown }).status as OrderStatus;
      if (!VALID_ORDER_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Invalid order status.' });
        return;
      }
      const order = await updateOrderStatusById(id, status);
      if (!order) {
        res.status(404).json({ error: 'Order not found.' });
        return;
      }
      res.json({ order });
    } catch (error) {
      console.error('Failed to update order status:', error);
      res.status(500).json({ error: 'Unable to update order status.' });
    }
  });

  return app;
}
