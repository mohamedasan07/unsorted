import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import Product from './models/product.js';
dotenv.config();

const app = express();
connectDB();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// =====================
// Paths / basic file DB
// =====================
// Resolve important paths relative to this file (backend/server.js),
// so routes work regardless of process.cwd().
// Note: this project uses ES modules ("type": "module"), so __dirname isn't available.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const productsPath = path.resolve(projectRoot, 'backend', 'seed.json');
const dbPath = path.resolve(projectRoot, 'backend', 'db.json');

function safeString(v) { return String(v ?? ''); }
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeBool(v) { return Boolean(v); }

const adminRoot = path.resolve(projectRoot, 'admin');
const customerRoot = projectRoot; // projectRoot contains index.html, style.css, script.js, etc.

// Ensure static roots exist (helps diagnose 404s)
if (!fs.existsSync(adminRoot)) {
  console.warn(`Admin static dir not found: ${adminRoot}`);
}
if (!fs.existsSync(path.join(customerRoot, 'index.html'))) {
  console.warn(`Customer index.html not found in: ${customerRoot}`);
}



function loadProducts() {
  try {
    const raw = fs.readFileSync(productsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.products) ? parsed.products : [];
  } catch {
    return [];
  }
}

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
  } catch {
    // no-op
  }
}

function normalizeProduct(p) {
  const out = {
    id: Number(p?.id),
    name: String(p?.name ?? ''),
    description: String(p?.description ?? ''),
    category: String(p?.category ?? ''),
    price: Number.isFinite(Number(p?.price)) ? Number(p?.price) : 0,
    oldPrice: Number.isFinite(Number(p?.oldPrice)) ? Number(p?.oldPrice) : 0,
    imageUrl: String(p?.imageUrl ?? p?.image ?? ''),
    stockQuantity: Number.isFinite(Number(p?.stockQuantity)) ? Number(p?.stockQuantity) : 0,
    sale: Boolean(p?.sale)
  };

  // avoid NaN IDs
  if (!Number.isFinite(out.id) || out.id <= 0) out.id = 0;
  return out;
}

function bootstrapDB() {
  const dbObj = loadDB();

  // If db products are empty, migrate from seed.json (customer site should keep working).
  if (!dbObj.products.length) {
    const seedProducts = loadProducts();
    dbObj.products = seedProducts.map(p => ({
      ...normalizeProduct(p),
      // seed.json typically has only {id,name,price,image}; fill the rest for admin features
      description: String(p?.description ?? ''),
      category: String(p?.category ?? ''),
      oldPrice: Number.isFinite(Number(p?.oldPrice)) ? Number(p?.oldPrice) : 0,
      stockQuantity: Number.isFinite(Number(p?.stockQuantity)) ? Number(p?.stockQuantity) : 50,
      sale: Boolean(p?.sale)
    }));
  }

  // Seed a minimal user list if missing (admin auth is separate)
  if (!dbObj.users.length) {
    dbObj.users = [{ id: 1, name: 'Demo User', email: 'user@unsorted.com', role: 'customer' }];
  }

  // Persist to ensure db.json is populated.
  persistDB(dbObj);
  return dbObj;
}

const db = bootstrapDB();

// Keep cart in memory (customer flows) for now.
const cart = [];


function getProduct(productId) {
  return db.products.find(p => p.id === Number(productId));
}

function normalizeProductImage(p) {
  // Keep backward compat with your seed.json field name `image`
  // Admin UI uses `imageUrl`.
  return {
    ...p,
    imageUrl: p.imageUrl || p.image || ''
  };
}

function persistProductsToDB() {
  try {
    const current = loadDB();
    current.products = db.products;

    // keep other collections intact
    if (Array.isArray(current.orders)) db.orders = current.orders;
    if (Array.isArray(current.users)) db.users = current.users;

    persistDB(current);
  } catch {
    // no-op
  }
}


// =====================
// Session cookie auth (beginner-friendly)
// =====================
const SESSION_COOKIE = 'unsorted_admin_session';

// =====================
// Static customer + admin frontends
// =====================
// Requirements:
// - Customer site must work at http://localhost:3001/
// - Admin site must work at http://localhost:3001/admin
// - Static files must load correctly (CSS/JS)
// - Backend must still handle APIs only under /api
app.use(express.static(customerRoot));


const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@unsorted.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

// Debugging: ensure login uses the expected credentials (remove later if needed)
console.log('[admin auth config]', {
  ADMIN_EMAIL,
  ADMIN_PASSWORD: ADMIN_PASSWORD ? '***set***' : '***missing***',
  SESSION_SECRET: SESSION_SECRET ? '***set***' : '***missing***',
  SESSION_COOKIE
});


function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  // Very simple signing: not production-grade.
  // For a beginner admin panel this is enough.
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

// in-memory session store
const sessions = new Set();

function requireAdmin(req, res, next) {
  const cookies = parseCookies(req);
  const signed = cookies[SESSION_COOKIE];
  const verified = verifySession(signed);
  if (!verified) {
    // Redirect non-auth users to admin login
    return res.redirect('/admin/login');
  }

  if (!sessions.has(verified.sessionId)) {
    res.clearCookie(SESSION_COOKIE, { path: '/admin' });
    return res.redirect('/admin/login');
  }

  req.admin = { email: ADMIN_EMAIL };
  return next();
}

// =====================
// Static admin + protection under /admin
// =====================
// 1) Serve admin static assets first (CSS/JS/login.html).
// 2) Protect only the admin *pages* and *admin APIs*.
//    (Admin JS loads /api/*; these will be protected later.)
app.use('/admin', express.static(adminRoot));

// Protect admin pages:
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(adminRoot, 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(adminRoot, 'login.html'));
});


app.post('/admin/login', express.json(), (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim();
  const cleanPassword = String(password || '');

  const emailOk = cleanEmail === ADMIN_EMAIL;
  const passOk = cleanPassword === ADMIN_PASSWORD;

  if (!emailOk || !passOk) {
    console.warn('[admin login failed]', {
      receivedEmail: cleanEmail,
      expectedEmail: ADMIN_EMAIL,
      passOk
    });
    return res.status(401).json({ error: 'Invalid email or password' });
  }


  const sessionId = randomUUID();
  sessions.add(sessionId);

  const signed = signSession(sessionId);

  res.cookie(SESSION_COOKIE, signed, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/admin'
  });

  return res.json({ ok: true });
});

app.post('/admin/logout', requireAdmin, (req, res) => {
  const cookies = parseCookies(req);
  const signed = cookies[SESSION_COOKIE];
  const verified = verifySession(signed);
  if (verified) sessions.delete(verified.sessionId);

  res.clearCookie(SESSION_COOKIE, { path: '/admin' });
  res.json({ ok: true });
});

// =====================
// Customer API (existing)
// =====================
// =====================
// Customer website
// =====================
app.get('/', (req, res) => {
  res.sendFile(path.join(customerRoot, 'index.html'));
});

// =====================
// Customer APIs
// =====================
app.get('/products', (req, res) => {
  res.json(db.products.map(normalizeProductImage));
});


app.post('/cart', (req, res) => {
  const { productId, quantity } = req.body || {};
  const qty = Math.max(1, Number(quantity || 1));

  const product = getProduct(productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const existing = db.cart.find(i => i.productId === Number(productId));
  if (existing) {
    existing.quantity += qty;
    return res.json({ cart: db.cart });
  }

  db.cart.push({
    id: randomUUID(),
    productId: Number(productId),
    name: product.name,
    price: product.price,
    image: product.imageUrl || product.image,
    quantity: qty
  });

  res.json({ cart: db.cart });
});

app.put('/cart/:id', (req, res) => {
  const productId = Number(req.params.id);
  const { quantity } = req.body || {};
  const qty = Number(quantity);

  const item = db.cart.find(i => i.productId === productId);
  if (!item) return res.status(404).json({ error: 'Cart item not found' });

  if (!Number.isFinite(qty) || qty < 0) return res.status(400).json({ error: 'Invalid quantity' });

  if (qty === 0) {
    db.cart = db.cart.filter(i => i.productId !== productId);
    return res.json({ cart: db.cart });
  }

  item.quantity = qty;
  res.json({ cart: db.cart });
});

app.delete('/cart/:id', (req, res) => {
  const productId = Number(req.params.id);
  db.cart = db.cart.filter(i => i.productId !== productId);
  res.json({ cart: db.cart });
});

app.get('/cart', (req, res) => {
  res.json({ cart: db.cart });
});

// =====================
// Admin API auth (partial/public)
// =====================
// Customer storefront must be able to load products instantly from GET /api/products.
// Admin dashboard requires auth for CRUD + operational APIs.

function requireAdminForApi(req, res, next) {
  // Public storefront endpoint (only this is unauthenticated)
  if (req.method === 'GET' && req.path === '/products') return next();

  // Protect all remaining API endpoints
  return requireAdmin(req, res, next);
}

app.use('/api', requireAdminForApi);


// Products CRUD
app.get('/api/products', async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post('/api/products', requireAdmin, async (req, res) => {
  const body = req.body || {};

  const name = safeString(body.name).trim();
  const description = safeString(body.description).trim();
  const category = safeString(body.category).trim();
  const imageUrl = safeString(body.imageUrl || body.image).trim();

  const price = safeNumber(body.price, 0);
  const oldPrice = safeNumber(body.oldPrice, 0);
  const stockQuantity = safeNumber(body.stockQuantity, 0);
  const sale = safeBool(body.sale);

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'price is invalid' });
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) return res.status(400).json({ error: 'stockQuantity is invalid' });

  const maxDoc = await Product.findOne().sort({ id: -1 }).select({ id: 1 }).lean();
  const maxId = Number(maxDoc?.id) || 0;
  const id = maxId + 1;

  const product = normalizeProduct({
    id,
    name,
    description,
    category,
    price,
    oldPrice,
    imageUrl,
    stockQuantity,
    sale
  });

  const created = await Product.create(product);
  res.json({ ok: true, product: created });
});

app.put('/api/products/:id', requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const p = await Product.findOne({ id: productId }).lean();
  if (!p || !Number.isFinite(productId) || productId <= 0) return res.status(404).json({ error: 'Product not found' });

  const body = req.body || {};

  const name = safeString(body.name).trim() || p.name;
  const description = safeString(body.description).trim();
  const category = safeString(body.category).trim();
  const imageUrl = safeString(body.imageUrl || body.image).trim() || p.imageUrl;

  const price = body.price === undefined ? p.price : safeNumber(body.price, p.price);
  const oldPrice = body.oldPrice === undefined ? p.oldPrice : safeNumber(body.oldPrice, p.oldPrice);
  const stockQuantity = body.stockQuantity === undefined ? p.stockQuantity : safeNumber(body.stockQuantity, p.stockQuantity);
  const sale = body.sale === undefined ? p.sale : safeBool(body.sale);

  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'price is invalid' });
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });
  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) return res.status(400).json({ error: 'stockQuantity is invalid' });

  const updated = await Product.findOneAndUpdate(
    { id: productId },
    {
      $set: {
        name,
        description,
        category,
        price,
        oldPrice,
        imageUrl,
        stockQuantity,
        sale
      }
    },
    { new: true }
  ).lean();

  return res.json({ ok: true, product: updated });
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  const productId = Number(req.params.id);
  const deleted = await Product.findOneAndDelete({ id: productId }).lean();
  if (!deleted) return res.status(404).json({ error: 'Product not found' });
  res.json({ ok: true });
});


// Orders
app.get('/api/orders', requireAdmin, (req, res) => {
  const orders = (db.orders || []).map(o => ({
    id: safeNumber(o?.id, 0),
    customerName: safeString(o?.customerName),
    customerEmail: safeString(o?.customerEmail),
    items: Array.isArray(o?.items) ? o.items.map(it => ({
      productId: safeNumber(it?.productId, 0),
      name: safeString(it?.name),
      priceAtOrder: safeNumber(it?.priceAtOrder, 0),
      imageUrl: safeString(it?.imageUrl || it?.image),
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

  // Normalize for safety
  order.customerName = safeString(order?.customerName);
  order.customerEmail = safeString(order?.customerEmail);
  order.totalRevenue = safeNumber(order?.totalRevenue, 0);
  order.createdAt = safeString(order?.createdAt);
  order.items = Array.isArray(order?.items) ? order.items : [];

  persistProductsToDB();

  res.json({ ok: true, order });
});

// Users
app.get('/api/users', (req, res) => {
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
  persistProductsToDB();
  res.json({ ok: true });
});


const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
async function seedProducts() {
  const count = await Product.countDocuments();

  if (count === 0) {
    const dbData = loadDB();

    await Product.insertMany(dbData.products);

    console.log('Products imported to MongoDB');
  }
}

seedProducts();


app.listen(PORT, HOST, () => {
  console.log(`UNSORTED backend running on http://${HOST}:${PORT}`);
});


