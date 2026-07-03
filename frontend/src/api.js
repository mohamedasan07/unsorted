// =====================
// api.js — Single API service for all data fetching
// =====================

const API_BASE = '';  // Same origin (Vite proxy handles routing)

/**
 * Generic fetch wrapper with error handling
 */
async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include',
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data;
}

// =====================
// Products
// =====================

let _productsCache = null;
let _productsCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Fetch all products from the API with caching
 */
export async function fetchProducts(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && _productsCache && (now - _productsCacheTime) < CACHE_TTL) {
    return _productsCache;
  }

  const products = await request('/api/products');
  _productsCache = Array.isArray(products) ? products : [];
  _productsCacheTime = now;
  return _productsCache;
}

/**
 * Fetch a single product by ID
 */
export async function fetchProduct(id) {
  return request(`/api/products/${id}`);
}

/**
 * Invalidate the products cache (call after admin changes)
 */
export function invalidateProductsCache() {
  _productsCache = null;
  _productsCacheTime = 0;
}

// =====================
// Cart (backend sync — optional)
// =====================

export async function syncCartItem(productId, quantity = 1) {
  try {
    await request('/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity })
    });
  } catch {
    // Cart sync is best-effort; localStorage is the primary source
  }
}
