// =====================
// products.js — Product rendering & product modal
// =====================

import { fetchProducts } from './api.js';
import { escapeHtml, formatINR, handleImageError, placeholderImage } from './utils.js';
import { addToCart } from './cart.js';

// =====================
// Category → Section mapping
// =====================
const SECTION_CONFIG = [
  { category: 'jerseys', sectionId: 'section-jerseys', gridId: 'grid-jerseys', title: 'JERSEYS' },
  { category: 'baggy', sectionId: 'section-baggy', gridId: 'grid-baggy', title: 'BAGGY' },
  { category: 'shirts', sectionId: 'section-shirts', gridId: 'grid-shirts', title: 'SHIRTS' },
  { category: 'tshirts', sectionId: 'section-tshirts', gridId: 'grid-tshirts', title: 'T-SHIRTS' },
  { category: 'accessories', sectionId: 'section-accessories', gridId: 'grid-accessories', title: 'ACCESSORIES' },
];

// =====================
// Product Card HTML
// =====================
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
        <img src="${imgSrc}" alt="${escapeHtml(p.name)}" loading="lazy" />
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

// =====================
// Render all product sections
// =====================
export async function loadAndRenderProducts() {
  // Show loading state
  SECTION_CONFIG.forEach(s => {
    const grid = document.getElementById(s.gridId);
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:40px 0; color:rgba(255,255,255,0.4); font-weight:700;">
          Loading products...
        </div>
      `;
    }
  });
  const bestGrid = document.getElementById('grid-bestseller');
  if (bestGrid) {
    bestGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:40px 0; color:rgba(255,255,255,0.4); font-weight:700;">
        Loading...
      </div>
    `;
  }

  try {
    const products = await fetchProducts(true);

    // Bucket products by category
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
    const bestSellers = products
      .slice()
      .sort((a, b) => Number(Boolean(b.sale)) - Number(Boolean(a.sale)) || b.price - a.price)
      .slice(0, 4);

    if (bestGrid) {
      bestGrid.innerHTML = bestSellers.map(productCardHTML).join('');
    }

    // Bind interactions after rendering
    bindAddToCartButtons();
    bindProductImageClicks();
    bindImageErrorHandlers();

  } catch (err) {
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
  }
}

// =====================
// Add to Cart button binding
// =====================
function bindAddToCartButtons() {
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    // Avoid double-binding
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

      // Open cart drawer
      const { toggleCart } = await_toggleCart();
      if (toggleCart) toggleCart();
    });
  });
}

// We need to import toggleCart but it causes circular dependency.
// Instead, dispatch a custom event that main.js listens to.
function await_toggleCart() {
  // Use dynamic import to break circular dependency
  return { toggleCart: window.__unsorted_toggleCart };
}

// =====================
// Image error handlers (lazy)
// =====================
function bindImageErrorHandlers() {
  document.querySelectorAll('.sale-card img').forEach(img => {
    if (img.dataset.errorBound === 'true') return;
    img.dataset.errorBound = 'true';

    img.addEventListener('error', () => {
      handleImageError(img, img.alt || '?');
    });
  });
}

// =====================
// Product Modal
// =====================

export function openProductModal(product) {
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

export function closeProductModal() {
  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  if (!overlay || !modal) return;

  overlay.classList.remove('active');
  modal.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  modal.setAttribute('aria-hidden', 'true');
}

export function bindProductModalControls() {
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
  });
}

// =====================
// Product Image Click → Modal
// =====================
function bindProductImageClicks() {
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

// =====================
// Search / Filter
// =====================
export function filterProducts(query) {
  const q = query.toLowerCase().trim();
  const cards = document.querySelectorAll('.sale-card');

  cards.forEach(card => {
    const titleEl = card.querySelector('.sale-name');
    const title = titleEl ? titleEl.textContent.toLowerCase() : '';
    card.style.display = title.includes(q) || !q ? '' : 'none';
  });
}
