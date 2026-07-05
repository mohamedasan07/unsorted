// =====================
// UNSORTED — Main Script
// Single source of truth: backend API (http://localhost:3001)
// =====================

// Backend base URL
const API_BASE =
  location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://unsorted-backend.onrender.com';

// =====================
// Global state
// =====================
let cart = JSON.parse(localStorage.getItem('theunsorted_cart')) || [];

// =====================
// Utilities
// =====================
const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatINR(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '₹0';
  return INR_FORMATTER.format(num);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

function placeholderImage(text) {
  const letter = escapeHtml(String(text || '?').charAt(0).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#1a1a1a"/>
    <rect x="0" y="0" width="400" height="400" fill="url(#grad)" opacity="0.3"/>
    <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff4757;stop-opacity:0.4"/>
      <stop offset="100%" style="stop-color:#ff6b81;stop-opacity:0.1"/>
    </linearGradient></defs>
    <text x="200" y="215" font-family="Inter,system-ui,sans-serif" font-size="80" font-weight="900" fill="rgba(255,255,255,0.2)" text-anchor="middle">${letter}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function handleImageError(img, name) {
  img.onerror = null;
  img.src = placeholderImage(name);
}

// =====================
// Initialize
// =====================
document.addEventListener('DOMContentLoaded', function() {
  updateCartBadge();
  renderCart();
  attachEventListeners();
  initFooterAccordions();
  bindCartDrawerControls();
  bindProductModalControls();

  // Load all products from backend API
  loadProductsAndRender().catch(err => {
    console.error('Failed to load products:', err);
  });
});

// =====================
// Event Listeners
// =====================
function attachEventListeners() {
  // Menu toggle with smooth scroll
  const menuLinks = document.querySelectorAll('.menu a[href^="#"]');
  menuLinks.forEach(link => {
    link.addEventListener('click', smoothScroll);
  });

  // Search functionality
  const searchModal = document.getElementById('searchModal');
  const searchInput = searchModal ? searchModal.querySelector('input') : null;
  if (searchInput) {
    searchInput.addEventListener('input', filterProducts);
  }
}

function initFooterAccordions() {
  const accordionButtons = document.querySelectorAll('[data-accordion-group] .footer-accordion-btn');
  accordionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!expanded));
    });
  });
}

// =====================
// UI Toggles
// =====================
function toggleMenu() {
  document.getElementById('menu').classList.toggle('active');
}

function toggleSearch(e) {
  if (e) e.stopPropagation();
  document.getElementById('searchModal').classList.toggle('active');
}

function toggleCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  const next = !sidebar.classList.contains('active');

  sidebar.classList.toggle('active', next);
  overlay?.setAttribute('aria-hidden', next ? 'false' : 'true');
  overlay?.classList.toggle('active', next);

  if (next) renderCart();
}

function toggleLogin(e) {
  if (e) e.stopPropagation();
  document.getElementById('loginModal').classList.toggle('active');
}

function smoothScroll(e) {
  e.preventDefault();
  const targetId = this.getAttribute('href').substring(1);
  const target = document.getElementById(targetId);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
  toggleMenu();
}

// =====================
// Search / Filter
// =====================
function filterProducts(e) {
  const query = e.target.value.toLowerCase().trim();
  const items = document.querySelectorAll('.sale-card');

  items.forEach(card => {
    const titleEl = card.querySelector('.sale-name');
    const title = titleEl ? titleEl.textContent.toLowerCase() : '';
    card.style.display = title.includes(query) || !query ? '' : 'none';
  });
}

// =====================
// Cart Functions
// =====================
function addToCart(product) {
  const existingItem = cart.find(item => String(item.id) === String(product.id));
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.imageUrl || product.image || '',
      quantity: 1
    });
  }

  localStorage.setItem('theunsorted_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();

  // Best-effort backend sync
  try {
    fetch(`${API_BASE}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: product.id, quantity: 1 })
    }).catch(() => {});
  } catch (err) { /* ignore */ }
}

function setCartQuantity(productId, nextQty) {
  const qty = Math.max(0, Number(nextQty));

  cart = cart.map(item => {
    if (String(item.id) !== String(productId)) return item;
    return { ...item, quantity: qty };
  }).filter(item => item.quantity > 0);

  localStorage.setItem('theunsorted_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}

function removeFromCart(id) {
  setCartQuantity(id, 0);
}

function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems || '0';
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

function renderCart() {
  const cartContainer = document.getElementById('cartItems');
  const totalEl = document.getElementById('cartTotal');
  const sidebar = document.getElementById('cartSidebar');

  if (!cartContainer) return;

  const wasOpen = sidebar ? sidebar.classList.contains('active') : false;

  if (!cart.length) {
    cartContainer.innerHTML = `
      <div style="color: rgba(255,255,255,0.7); padding: 18px 0; font-weight: 600;">
        Your cart is empty.
      </div>
    `;
    if (totalEl) totalEl.textContent = '₹0';
    if (sidebar && wasOpen) sidebar.classList.add('active');
    return;
  }

  cartContainer.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;
    const imgSrc = item.imageUrl || item.image || '';

    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';

    cartItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <img src="${imgSrc}" alt="${escapeHtml(item.name)}" loading="lazy">
        <div class="cart-item-info">
          <h4>${escapeHtml(item.name)}</h4>
          <small>${formatINR(item.price)} each</small>
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
            <button type="button" data-cart-action="dec" data-id="${item.id}"
              style="width:30px;height:30px;border-radius:999px;border:1px solid rgba(255,71,87,0.55);background:rgba(255,71,87,0.10);color:#fff;cursor:pointer;font-weight:900;">−</button>
            <span style="min-width:18px;text-align:center;font-weight:900;">${item.quantity}</span>
            <button type="button" data-cart-action="inc" data-id="${item.id}"
              style="width:30px;height:30px;border-radius:999px;border:1px solid rgba(255,71,87,0.55);background:rgba(255,71,87,0.10);color:#fff;cursor:pointer;font-weight:900;">+</button>
          </div>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="cart-item-price">${formatINR(lineTotal)}</span>
        <button type="button" data-cart-action="remove" data-id="${item.id}"
          style="background:none;border:none;color:#ff4757;font-size:18px;cursor:pointer;">×</button>
      </div>
    `;

    // Handle broken cart images
    const img = cartItem.querySelector('img');
    if (img) {
      img.onerror = () => handleImageError(img, item.name);
    }

    cartContainer.appendChild(cartItem);
  });

  if (totalEl) totalEl.textContent = formatINR(total);
  if (sidebar && wasOpen) sidebar.classList.add('active');
}

// =====================
// Cart Drawer Controls
// =====================
function bindCartDrawerControls() {
  const overlay = document.getElementById('cartOverlay');
  const sidebar = document.getElementById('cartSidebar');
  const cartItems = document.getElementById('cartItems');
  const closeBtn = document.getElementById('cartCloseBtn');

  function closeCart() {
    sidebar?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('active');
  }

  overlay?.addEventListener('click', closeCart);
  closeBtn?.addEventListener('click', closeCart);

  // Delegated click handler for cart quantity buttons
  cartItems?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cart-action]');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const action = btn.getAttribute('data-cart-action');
    const id = btn.getAttribute('data-id');
    if (!action || !id) return;

    const item = cart.find(i => String(i.id) === String(id));
    const current = item ? item.quantity : 0;

    if (action === 'inc') setCartQuantity(id, current + 1);
    else if (action === 'dec') setCartQuantity(id, current - 1);
    else if (action === 'remove') removeFromCart(id);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (sidebar?.classList.contains('active')) closeCart();
    }
  });
}

// Outside click to close menus (but not cart)
window.onclick = function(event) {
  const menu = document.getElementById('menu');
  const search = document.getElementById('searchModal');
  const loginModal = document.getElementById('loginModal');

  if (event.target === menu || event.target.matches('.left *') || event.target.matches('.left')) return;
  if (menu) menu.classList.remove('active');

  if (!event.target.closest('#searchModal')) {
    if (search) search.classList.remove('active');
  }

  if (!event.target.closest('#loginModal') && !event.target.closest('.login-content')) {
    if (loginModal) loginModal.classList.remove('active');
  }
};

// =====================
// Product Details Modal
// =====================
function openProductModal(product) {
  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  if (!overlay || !modal) return;

  const safe = (v) => (v === undefined || v === null) ? '' : String(v);

  const name = safe(product?.name);
  const price = safe(product?.price);
  const oldPrice = safe(product?.oldPrice);
  const imageUrl = safe(product?.imageUrl || product?.image);
  const category = safe(product?.category);
  const description = safe(product?.description);

  const imgEl = document.getElementById('productModalImage');
  if (imgEl) {
    imgEl.src = imageUrl;
    imgEl.alt = name || 'Product';
    imgEl.onerror = () => handleImageError(imgEl, name);
  }

  const catEl = document.getElementById('productModalCategory');
  if (catEl) catEl.textContent = category.toUpperCase();

  const titleEl = document.getElementById('productModalTitle');
  if (titleEl) titleEl.textContent = name;

  const oldPriceEl = document.getElementById('productModalOldPrice');
  if (oldPriceEl) oldPriceEl.textContent = oldPrice ? formatINR(oldPrice) : '';

  const priceEl = document.getElementById('productModalPrice');
  if (priceEl) priceEl.textContent = price ? formatINR(price) : '';

  const descEl = document.getElementById('productModalDescription');
  if (descEl) descEl.textContent = description || `Premium ${category || 'UNSORTED'} drop. Raw style, built to last.`;

  const addBtn = document.getElementById('productModalAddToCart');
  if (addBtn) {
    addBtn.dataset.id = safe(product?.id);
    addBtn.dataset.name = name;
    addBtn.dataset.price = price;
    addBtn.dataset.image = imageUrl;
  }

  overlay.classList.add('active');
  modal.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  modal.setAttribute('aria-hidden', 'false');
}

function closeProductModal() {
  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  if (!overlay || !modal) return;

  overlay.classList.remove('active');
  modal.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  modal.setAttribute('aria-hidden', 'true');
}

function bindProductModalControls() {
  const closeBtn = document.getElementById('productModalCloseBtn');
  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  const addBtn = document.getElementById('productModalAddToCart');

  closeBtn?.addEventListener('click', closeProductModal);
  overlay?.addEventListener('click', closeProductModal);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) {
      closeProductModal();
    }
  });

  addBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const product = {
      id: addBtn.dataset.id,
      name: addBtn.dataset.name,
      price: addBtn.dataset.price,
      imageUrl: addBtn.dataset.image,
    };

    addToCart(product);
    closeProductModal();
    toggleCart();
  });
}

// =====================
// Products — Load from Backend API
// =====================

// Category config: maps db.json categories to HTML section grid IDs
const SECTION_CONFIG = [
  { category: 'jerseys',     gridId: 'grid-jerseys' },
  { category: 'baggy',       gridId: 'grid-baggy' },
  { category: 'shirts',      gridId: 'grid-shirts' },
  { category: 'tshirts',     gridId: 'grid-tshirts' },
  { category: 'accessories', gridId: 'grid-accessories' },
];

function productCardHTML(p) {
  const price = Number(p.price || 0);
  const oldPrice = Number(p.oldPrice || 0);
  const sale = Boolean(p.sale);
  const showOld = oldPrice > 0;
  const badge = sale ? `<span class="sale-badge">Sale</span>` : '';
  const imgSrc = p.imageUrl || '';

  return `
    <div class="sale-card" data-product-id="${p.id}">
      ${badge}
      <div class="sale-img">
        <img src="${imgSrc}" alt="${escapeHtml(p.name)}" loading="lazy" onerror="handleImageError(this, '${escapeHtml(p.name)}')" />
      </div>
      <div class="sale-info">
        <div class="sale-name">${escapeHtml(p.name)}</div>
        <div class="sale-prices">
          <div class="sale-original">${showOld ? '₹ ' + oldPrice.toLocaleString('en-IN') : ''}</div>
          <div class="sale-discount">₹ ${price.toLocaleString('en-IN')}</div>
        </div>
        ${p.stockQuantity !== undefined ? `<div class="sale-stock" style="font-size:0.8rem;color:rgba(255,255,255,0.5);font-weight:700;">${Number(p.stockQuantity) > 0 ? `In Stock (${p.stockQuantity})` : '<span style="color:#ff4757;">Out of Stock</span>'}</div>` : ''}
        <button class="add-to-cart" type="button"
          data-id="${p.id}"
          data-name="${escapeHtml(p.name)}"
          data-price="${price}"
          data-image="${escapeHtml(imgSrc)}"
          ${Number(p.stockQuantity) <= 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>
          Add to Cart
        </button>
      </div>
    </div>
  `;
}

function loadProductsAndRender() {
  

  return fetch(`${API_BASE}/api/products`)
    .then(r => {
      if (!r.ok) throw new Error(`API error ${r.status}`);
      return r.json();
    })
    .then(list => {
      const products = Array.isArray(list) ? list : [];

      // Bucket products by category (using the category field from db.json)
      const buckets = {};
      SECTION_CONFIG.forEach(s => { buckets[s.category] = []; });

      products.forEach(p => {
        const cat = String(p.category || '').toLowerCase();
        if (buckets[cat]) {
          buckets[cat].push(p);
        }
      });

      // Render each category section
      SECTION_CONFIG.forEach(s => {
        const grid = document.getElementById(s.gridId);
        if (!grid) return;

        const items = buckets[s.category] || [];
        if (items.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:40px 0; color:rgba(255,255,255,0.4); font-weight:700;">
              No products in this category yet.
            </div>
          `;
        } else {
          grid.innerHTML = items.map(productCardHTML).join('');
        }
      });

      // Best sellers: products with sale=true first, then by price descending, limit 4
      const bestGrid = document.getElementById('grid-bestseller');
      if (bestGrid) {
        const bestSellers = products
          .slice()
          .sort((a, b) => Number(Boolean(b.sale)) - Number(Boolean(a.sale)) || b.price - a.price)
          .slice(0, 4);
        bestGrid.innerHTML = bestSellers.map(productCardHTML).join('');
      }

      // Bind interactions after rendering
      bindAddToCartButtons();
      bindProductImageClick();
    })
    .catch(err => {
      console.error('Failed to load products:', err);

      // Show error state
      SECTION_CONFIG.forEach(s => {
        const grid = document.getElementById(s.gridId);
        if (grid) {
          grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:40px 0; color:#ff4757; font-weight:700;">
              Failed to load products. Is the backend running?
            </div>
          `;
        }
      });
      const bestGrid = document.getElementById('grid-bestseller');
      if (bestGrid) {
        bestGrid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding:40px 0; color:#ff4757; font-weight:700;">
            Failed to load products. Is the backend running?
          </div>
        `;
      }
    });
}

// =====================
// Add to Cart button binding (for dynamically rendered cards)
// =====================
function bindAddToCartButtons() {
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    // Skip modal add button and already-bound buttons
    if (btn.id === 'productModalAddToCart') return;
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (btn.disabled) return;

      const product = {
        id: btn.getAttribute('data-id'),
        name: btn.getAttribute('data-name'),
        price: btn.getAttribute('data-price'),
        imageUrl: btn.getAttribute('data-image'),
      };

      addToCart(product);
      toggleCart();
    });
  });
}

// =====================
// Product Image Click → Modal
// =====================
function bindProductImageClick() {
  document.querySelectorAll('.sale-card').forEach(card => {
    const img = card.querySelector('.sale-img img');
    if (!img || img.dataset.modalBound === 'true') return;
    img.dataset.modalBound = 'true';
    img.style.cursor = 'pointer';

    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const name = card.querySelector('.sale-name')?.textContent?.trim() || img.alt || '';
      const section = card.closest('.sale-products');
      const category = section?.querySelector('.sale-products-title')?.textContent?.trim() || '';
      const oldPrice = card.querySelector('.sale-original')?.textContent?.trim() || '';
      const price = card.querySelector('.sale-discount')?.textContent?.trim() || '';
      const addBtn = card.querySelector('.add-to-cart');
      const id = addBtn?.getAttribute('data-id') || '';
      const description = `Premium ${category || 'UNSORTED'} drop. Raw style, built to last.`;

      openProductModal({
        id,
        name,
        price: addBtn?.getAttribute('data-price') || price,
        oldPrice,
        imageUrl: addBtn?.getAttribute('data-image') || img.src,
        category,
        description,
      });
    });
  });
}
