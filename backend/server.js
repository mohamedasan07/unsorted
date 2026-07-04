import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

// =====================
// Path resolution
// =====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.resolve(__dirname, 'db.json');
const imagesDir = path.resolve(projectRoot, 'images');
const adminRoot = path.resolve(projectRoot, 'admin');

// =====================
// Helpers
// =====================
function safeString(v) { return String(v ?? ''); }
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeBool(v) { return Boolean(v); }

// =====================
// db.json — Single Source of Truth
// =====================
function loadDB() {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      products: Array.isArray(parsed?.products) ? parsed.products : [],
      orders: Array.isArray(parsed?.orders) ? parsed.orders : [],
      users: Array.isArray(parsed?.users) ? parsed.users : [],
      meta: parsed?.meta && typeof parsed.meta === 'object' ? parsed.meta : {}
    };
  } catch {
    return { products: [], orders: [], users: [], meta: {} };
  }
}

function persistDB(dbObj) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(dbObj, null, 2), 'utf-8');
  } catch (err) {
    console.error('[persistDB] Failed to write db.json:', err.message);
  }
}

// Load database into memory on startup
let db = loadDB();

// In-memory cart (not persisted — frontend uses localStorage)
let cart = [];

// =====================
// Product normalization
// =====================
function normalizeProduct(p) {
  return {
    id: safeNumber(p?.id, 0),
    name: safeString(p?.name).trim(),
    description: safeString(p?.description).trim(),
    category: safeString(p?.category).trim(),
    price: safeNumber(p?.price, 0),
    oldPrice: safeNumber(p?.oldPrice, 0),
    imageUrl: safeString(p?.imageUrl || p?.image).trim(),
    stockQuantity: safeNumber(p?.stockQuantity, 0),
    sale: safeBool(p?.sale)
  };
}

function getNextId() {
  const maxId = db.products.reduce((max, p) => Math.max(max, safeNumber(p.id, 0)), 0);
  return maxId + 1;
}

function findProduct(id) {
  const numId = Number(id);
  return db.products.find(p => p.id === numId);
}

function persistProducts() {
  const current = loadDB();
  current.products = db.products;
  current.orders = db.orders;
  current.users = db.users;
  persistDB(current);
}

// =====================
// Express App Setup
// =====================
const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3001",
    "https://unsorted-swart.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());

// =====================
// Static file serving
// =====================
// Serve product images
app.use('/images', express.static(imagesDir));
app.use('/image', express.static(imagesDir));

// Serve admin static assets only (CSS, JS — NOT index.html, which needs auth check)
app.use('/admin', express.static(adminRoot, {
  index: false  // Don't serve index.html automatically, let route handlers manage it
}));

// Serve customer-facing static files (index.html, style.css, script.js)
app.use(express.static(projectRoot, {
  index: 'index.html',
  extensions: ['html']
}));

// =====================
// Admin Auth (session cookie)
// =====================
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@unsorted.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const SESSION_COOKIE = 'unsorted_admin_session';

const sessions = new Set();

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  const out = {};
  header.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=');
    out[k] = decodeURIComponent(v.join('=') || '');
  });
  return out;
}

function signSession(sessionId) {
  return Buffer.from(`${sessionId}:${SESSION_SECRET}`).toString('base64');
}

function verifySession(signed) {
  if (!signed) return null;
  try {
    const decoded = Buffer.from(String(signed), 'base64').toString('utf-8');
    const [sessionId, secret] = decoded.split(':');
    if (!sessionId || secret !== SESSION_SECRET) return null;
    return { sessionId };
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const signed = cookies[SESSION_COOKIE];
  const verified = verifySession(signed);

  if (!verified) {
    // API requests get 401, page requests get redirect
    if (req.path.startsWith('/api')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/admin/login');
  }

  req.admin = { email: ADMIN_EMAIL };
  return next();
}

// =====================
// Admin Auth Routes
// =====================
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(adminRoot, 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(adminRoot, 'login.html'));
});

app.post('/admin/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = safeString(email).trim();
  const cleanPassword = safeString(password);

  if (cleanEmail !== ADMIN_EMAIL || cleanPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const sessionId = randomUUID();
  sessions.add(sessionId);
  const signed = signSession(sessionId);

  res.cookie(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/'
  });

  return res.json({ ok: true });
});

app.post('/admin/logout', (req, res) => {
  const cookies = parseCookies(req);
  const signed = cookies[SESSION_COOKIE];
  const verified = verifySession(signed);
  if (verified) sessions.delete(verified.sessionId);

  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

// =====================
// Products API — PUBLIC reads, ADMIN writes
// =====================

// GET /api/products — Public
app.get('/api/products', (req, res) => {
  res.json(db.products.map(normalizeProduct));
});

// GET /api/products/:id — Public
app.get('/api/products/:id', (req, res) => {
  const product = findProduct(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(normalizeProduct(product));
});

// POST /api/products — Admin only
app.post('/api/products', requireAdmin, (req, res) => {
  const body = req.body || {};

  const name = safeString(body.name).trim();
  const description = safeString(body.description).trim();
  const category = safeString(body.category).trim();
  const imageUrl = safeString(body.imageUrl || body.image).trim();
  const price = safeNumber(body.price, -1);
  const oldPrice = safeNumber(body.oldPrice, 0);
  const stockQuantity = safeNumber(body.stockQuantity, -1);
  const sale = safeBool(body.sale);

  // Validation
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (price < 0) return res.status(400).json({ error: 'price must be a non-negative number' });
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (stockQuantity < 0) return res.status(400).json({ error: 'stockQuantity must be a non-negative number' });

  const id = getNextId();

  const product = normalizeProduct({
    id, name, description, category, price, oldPrice, imageUrl, stockQuantity, sale
  });

  db.products.push(product);
  persistProducts();

  res.status(201).json({ ok: true, product });
});

// PUT /api/products/:id — Admin only
app.put('/api/products/:id', requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const index = db.products.findIndex(p => p.id === productId);

  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  const existing = db.products[index];
  const body = req.body || {};

  const name = safeString(body.name).trim() || existing.name;
  const description = body.description !== undefined ? safeString(body.description).trim() : existing.description;
  const category = body.category !== undefined ? safeString(body.category).trim() : existing.category;
  const imageUrl = safeString(body.imageUrl || body.image).trim() || existing.imageUrl;
  const price = body.price !== undefined ? safeNumber(body.price, existing.price) : existing.price;
  const oldPrice = body.oldPrice !== undefined ? safeNumber(body.oldPrice, existing.oldPrice) : existing.oldPrice;
  const stockQuantity = body.stockQuantity !== undefined ? safeNumber(body.stockQuantity, existing.stockQuantity) : existing.stockQuantity;
  const sale = body.sale !== undefined ? safeBool(body.sale) : existing.sale;

  // Validation
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (price < 0) return res.status(400).json({ error: 'price must be a non-negative number' });
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (stockQuantity < 0) return res.status(400).json({ error: 'stockQuantity must be a non-negative number' });

  const updated = normalizeProduct({
    id: productId, name, description, category, price, oldPrice, imageUrl, stockQuantity, sale
  });

  db.products[index] = updated;
  persistProducts();

  res.json({ ok: true, product: updated });
});

// DELETE /api/products/:id — Admin only
app.delete('/api/products/:id', requireAdmin, (req, res) => {
  const productId = Number(req.params.id);
  const index = db.products.findIndex(p => p.id === productId);

  if (index === -1) return res.status(404).json({ error: 'Product not found' });

  db.products.splice(index, 1);
  persistProducts();

  res.json({ ok: true });
});

// =====================
// Cart API (in-memory, for frontend sync)
// =====================
app.get('/cart', (req, res) => {
  res.json({ cart });
});

app.post('/cart', (req, res) => {
  const { productId, quantity } = req.body || {};
  const qty = Math.max(1, safeNumber(quantity, 1));
  const product = findProduct(productId);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = cart.find(i => i.productId === Number(productId));
  if (existing) {
    existing.quantity += qty;
    return res.json({ cart });
  }

  cart.push({
    id: randomUUID(),
    productId: Number(productId),
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    quantity: qty
  });

  res.json({ cart });
});

app.put('/cart/:id', (req, res) => {
  const productId = Number(req.params.id);
  const { quantity } = req.body || {};
  const qty = Number(quantity);

  const item = cart.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ error: 'Cart item not found' });
  if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'Invalid quantity' });

  if (qty === 0) {
    cart = cart.filter(i => i.productId !== productId);
    return res.json({ cart });
  }

  item.quantity = qty;
  res.json({ cart });
});

app.delete('/cart/:id', (req, res) => {
  const productId = Number(req.params.id);
  cart = cart.filter(i => i.productId !== productId);
  res.json({ cart });
});

// =====================
// Orders API — Admin only
// =====================
app.get('/api/orders', requireAdmin, (req, res) => {
  const orders = (db.orders || []).map(o => ({
    id: safeNumber(o?.id, 0),
    customerName: safeString(o?.customerName),
    customerEmail: safeString(o?.customerEmail),
    items: Array.isArray(o?.items) ? o.items.map(it => ({
      productId: safeNumber(it?.productId, 0),
      name: safeString(it?.name),
      priceAtOrder: safeNumber(it?.priceAtOrder, 0),
      imageUrl: safeString(it?.imageUrl),
      quantity: safeNumber(it?.quantity, 0)
    })) : [],
    paymentStatus: safeString(o?.paymentStatus),
    orderStatus: safeString(o?.orderStatus),
    totalRevenue: safeNumber(o?.totalRevenue, 0),
    createdAt: safeString(o?.createdAt)
  }));

  res.json({ orders });
});

app.put('/api/orders/:id', requireAdmin, (req, res) => {
  const orderId = safeNumber(req.params.id, 0);
  const order = (db.orders || []).find(o => safeNumber(o?.id, 0) === orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const body = req.body || {};
  if (body.paymentStatus !== undefined) order.paymentStatus = safeString(body.paymentStatus);
  if (body.orderStatus !== undefined) order.orderStatus = safeString(body.orderStatus);

  persistProducts();
  res.json({ ok: true, order });
});

// =====================
// Users API — Admin only
// =====================
app.get('/api/users', requireAdmin, (req, res) => {
  const users = (db.users || []).map(u => ({
    id: safeNumber(u?.id, 0),
    name: safeString(u?.name),
    email: safeString(u?.email),
    role: safeString(u?.role)
  }));

  res.json({ users });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const userId = safeNumber(req.params.id, 0);
  const before = (db.users || []).length;
  db.users = (db.users || []).filter(u => safeNumber(u?.id, 0) !== userId);
  if ((db.users || []).length === before) return res.status(404).json({ error: 'User not found' });

  persistProducts();
  res.json({ ok: true });
});

// =====================
// Start Server
// =====================
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`UNSORTED backend running on http://${HOST}:${PORT}`);
  console.log(`  Products: ${db.products.length}`);
  console.log(`  Images dir: ${imagesDir}`);
  console.log(`  Admin: http://localhost:${PORT}/admin`);
});
