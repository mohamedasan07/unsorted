// Global state
let cart = JSON.parse(localStorage.getItem('theunsorted_cart')) || [];

// Backend base URL (change if needed)
const API_BASE = 'http://localhost:3001';

// Initialize
document.addEventListener('DOMContentLoaded', function() {
  updateCartBadge();
  renderCart();
  attachEventListeners();
  initFooterAccordions();
  bindAddToCartButtons();

  // Cart drawer controls (fixed open/close + ESC)
  bindCartDrawerControls();

  // Search is handled by attachEventListeners() via filterProducts

  // Live products rendering from shared backend DB
  loadProductsAndRender().catch(console.error);

  bindProductModalControls();
  bindProductImageClick();

});

function attachEventListeners() {
  // Menu toggle with smooth scroll
  const menuLinks = document.querySelectorAll('.menu a[href^="#"]');
  menuLinks.forEach(link => {
    link.addEventListener('click', smoothScroll);
  });

  // Login toggle
  const loginLink = document.querySelector('.menu a[href="login.html"]');
  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      toggleLogin();
    });
  }

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

function toggleMenu() {
  document.getElementById('menu').classList.toggle('active');
}

function toggleSearch() {
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

function toggleLogin() {
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

function filterProducts(e) {
  const query = e.target.value.toLowerCase().trim();

  // Your current product markup uses .sale-card and .sale-name
  const items = document.querySelectorAll('.sale-card');

  items.forEach(card => {
    const titleEl = card.querySelector('.sale-name');
    const title = titleEl ? titleEl.textContent.toLowerCase() : '';
    card.style.display = title.includes(query) ? '' : 'none';
  });
}

// Currency formatting (single source of truth)
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

// Cart functions
// Notes:
// - Current frontend cart is persisted in localStorage as `theunsorted_cart`
// - Backend stores cart in memory, but the UI remains functional even if backend is offline.

function addToCart(product) {
  const existingItem = cart.find(item => String(item.id) === String(product.id));
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image: product.image,
      quantity: 1
    });
  }

  localStorage.setItem('theunsorted_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCart();
}

function setCartQuantity(productId, nextQty) {
  const qty = Math.max(0, Number(nextQty));

  // Local cart update
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

function bindAddToCartButtons() {
  // Button handler: reads data-* attributes from the clicked button.
  // This replaces broken/undefined inline handlers.
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      const product = {
        id: btn.getAttribute('data-id'),
        name: btn.getAttribute('data-name'),
        price: btn.getAttribute('data-price'),
        image: btn.getAttribute('data-image'),
      };

      // Optimistic UI
      addToCart(product);

      // Try backend sync (optional)
      // If backend is running, keep cart state consistent there too.
      try {
        await fetch(`${API_BASE}/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, quantity: 1 })
        });
      } catch (err) {
        // Ignore backend errors for local-only functionality
      }

      // Open cart drawer smoothly
      toggleCart();
    });
  });
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

  // If empty, show a friendly empty state and hide badge
  if (!cart.length) {
    cartContainer.innerHTML = `
      <div style="color: rgba(255,255,255,0.7); padding: 18px 0; font-weight: 600;">
        Your cart is empty.
      </div>
    `;
    totalEl.textContent = 'Total: ₹0';
    if (sidebar && wasOpen) sidebar.classList.add('active');
    return;
  }

  cartContainer.innerHTML = '';
  let total = 0;

  cart.forEach(item => {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;

    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';

    cartItem.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
        <img src="${item.image}" alt="${item.name}" onerror="this.src='https://via.placeholder.com/50?text=${item.name.charAt(0)}'">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <small>${formatINR(item.price)} each</small>
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 8px;">
            <button
              type="button"
              data-cart-action="dec"
              data-id="${item.id}"
              style="
                width: 30px; height: 30px;
                border-radius: 999px;
                border: 1px solid rgba(255,71,87,0.55);
                background: rgba(255,71,87,0.10);
                color: #fff;
                cursor: pointer;
                font-weight: 900;
              ">−</button>

            <span style="min-width: 18px; text-align: center; font-weight: 900;">${item.quantity}</span>

            <button
              type="button"
              data-cart-action="inc"
              data-id="${item.id}"
              style="
                width: 30px; height: 30px;
                border-radius: 999px;
                border: 1px solid rgba(255,71,87,0.55);
                background: rgba(255,71,87,0.10);
                color: #fff;
                cursor: pointer;
                font-weight: 900;
              ">+</button>
          </div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="cart-item-price">${formatINR(lineTotal)}</span>
        <button
          type="button"
          data-cart-action="remove"
          data-id="${item.id}"
          style="background: none; border: none; color: #ff4757; font-size: 18px; cursor: pointer;">×</button>
      </div>
    `;

    cartContainer.appendChild(cartItem);
  });

  totalEl.textContent = `Subtotal: ${formatINR(total)}`;

  if (sidebar && wasOpen) sidebar.classList.add('active');
}


// Outside click to close
window.onclick = function(event) {
  const menu = document.getElementById('menu');
  const search = document.getElementById('searchModal');
  const cartSidebar = document.getElementById('cartSidebar');
  const loginModal = document.getElementById('loginModal');

  if (event.target === menu || (event.target.matches('.left *') || event.target.matches('.left'))) return;
  if (menu) menu.classList.remove('active');

  if (!event.target.closest('.right') && !event.target.closest('#cartSidebar')) {
    if (cartSidebar) cartSidebar.classList.remove('active');
  }

  if (!event.target.closest('#searchModal')) {
    if (search) search.classList.remove('active');
  }

  if (!event.target.closest('#loginModal')) {
    if (loginModal) loginModal.classList.remove('active');
  }
};

// =====================
// Quantity + cart controls (increase / decrease / remove)
// =====================

// Expose helpers used by cart HTML buttons
window.changeQty = function(productId, delta) {
  const item = cart.find(i => String(i.id) === String(productId));
  const current = item ? item.quantity : 0;
  setCartQuantity(productId, current + delta);
};

window.removeItem = function(productId) {
  removeFromCart(productId);
};

function bindCartDrawerControls() {
  const overlay = document.getElementById('cartOverlay');
  const sidebar = document.getElementById('cartSidebar');
  const cartItems = document.getElementById('cartItems');

  const closeBtn = document.getElementById('cartCloseBtn');

  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('active');
  });

  closeBtn?.addEventListener('click', () => {
    sidebar?.classList.remove('active');
    overlay?.setAttribute('aria-hidden', 'true');
    overlay?.classList.remove('active');
  });

  // Prevent cart buttons from triggering window.onclick (which closes the sidebar)
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
    if (e.key !== 'Escape') return;
    if (sidebar?.classList.contains('active')) {
      sidebar.classList.remove('active');
      overlay?.setAttribute('aria-hidden', 'true');
      overlay?.classList.remove('active');
    }
  });
}

// =====================
// Product details modal
// =====================

function openProductModal(product) {
  const overlay = document.getElementById('productModalOverlay');
  const modal = document.getElementById('productModal');
  if (!overlay || !modal) return;

  const safe = (v) => (v === undefined || v === null) ? '' : String(v);

  const name = safe(product?.name);
  const price = safe(product?.price);
  const oldPrice = safe(product?.oldPrice);
  const image = safe(product?.image);
  const category = safe(product?.category);
  const description = safe(product?.description);

  document.getElementById('productModalImage')?.setAttribute('src', image);
  document.getElementById('productModalImage')?.setAttribute('alt', name || 'Product');

  document.getElementById('productModalCategory').textContent = category;
  document.getElementById('productModalTitle').textContent = name;
  document.getElementById('productModalOldPrice').textContent = oldPrice ? oldPrice : '';
  document.getElementById('productModalPrice').textContent = price ? price : '';
  document.getElementById('productModalDescription').textContent = description;

  const addBtn = document.getElementById('productModalAddToCart');
  if (addBtn) {
    addBtn.dataset.id = safe(product?.id);
    addBtn.dataset.name = name;
    addBtn.dataset.price = price;
    addBtn.dataset.image = image;
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
    if (e.key !== 'Escape') return;
    if (modal?.classList.contains('active')) closeProductModal();
  });

  addBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const product = {
      id: addBtn.dataset.id,
      name: addBtn.dataset.name,
      price: addBtn.dataset.price,
      image: addBtn.dataset.image,
    };

    addToCart(product);
    closeProductModal();
  });
}

function loadProductsAndRender() {
  const sections = [
    { id: 'categories', gridId: 'grid-categories' },
    { id: 'Baggy', gridId: 'grid-Baggy' },
    { id: 'shirts', gridId: 'grid-shirts' },
    { id: 'tshirts', gridId: 'grid-tshirts' },
    { id: 'accessories', gridId: 'grid-accessories' },
    { id: 'bestseller', gridId: 'grid-bestseller' }
  ];

  const gridByKey = {};
  sections.forEach(s => {
    const el = document.getElementById(s.gridId);
    if (el) gridByKey[s.id] = el;
  });

  const cartBtnRebind = () => {
    // Buttons already have global bindAddToCartButtons() that reads data-*
    bindAddToCartButtons();
  };

  const cardHTML = (p) => {
    const price = Number(p.price || 0);
    const oldPrice = Number(p.oldPrice || 0);
    const sale = Boolean(p.sale);

    const showOld = sale && oldPrice > 0;

    // badge text: match your existing CSS expecting .sale-badge
    const badge = sale ? `<span class="sale-badge">Sale</span>` : '';

    // We keep original markup classes used by CSS; populate values safely.

    return `
      <div class="sale-card">
        ${badge}
        <div class="sale-img">
          <img src="${p.imageUrl || p.image || ''}" alt="${escapeHtml(p.name)}" />
        </div>
        <div class="sale-info">
          <div class="sale-name">${escapeHtml(p.name)}</div>
          <div class="sale-prices">
            <div class="sale-original">${showOld ? '₹ ' + oldPrice.toLocaleString('en-IN') : ''}</div>
            <div class="sale-discount">₹ ${price.toLocaleString('en-IN')}</div>
          </div>
          <button class="add-to-cart" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-price="${price}" data-image="${p.imageUrl || p.image || ''}">Add to Cart</button>
        </div>
      </div>
    `;
  };

  const escapeHtml = (str) => {
    return String(str ?? '').replace(/[&<>'"]/g, (c) => ({
      '&': '&amp;',
      '<': '<',
      '>': '>',
      "'": '&#39;',
      '"': '"'
    }[c]));
  };

  const api = `${API_BASE}/api/products`;

  return fetch(api)
    .then(r => r.json())
    .then(list => {
      // clear grids
      Object.values(gridByKey).forEach(el => (el.innerHTML = ''));

      const products = Array.isArray(list) ? list : [];

      // Heuristic category mapping (since seed/db category may be empty)
      const getBucket = (p) => {
        const name = String(p.name || '').toLowerCase();
        const cat = String(p.category || '').toLowerCase();

        if (cat === 'accessories') return 'accessories';
        if (name.includes('baggy')) return 'Baggy';
        if (name.includes('overshirt') || name.includes('shirt') || name.includes('oxford')) return 'shirts';
        if (name.includes('tee') || name.includes('t-shirt') || name.includes('tshirt') || name.includes('t-shirts') || name.includes('graphic')) return 'tshirts';
        return 'categories';
      };

      const buckets = { categories: [], Baggy: [], shirts: [], tshirts: [], accessories: [] };
      products.forEach(p => {
        const b = getBucket(p);
        buckets[b] = buckets[b] || [];
        buckets[b].push(p);
      });

      // Render main buckets
      Object.keys(buckets).forEach(k => {
        const grid = gridByKey[k];
        if (!grid) return;
        grid.innerHTML = buckets[k].map(cardHTML).join('');
      });

      // Best sellers: by simple heuristic -> sale first else first 4
      const best = products.slice().sort((a, b) => Number(Boolean(b.sale)) - Number(Boolean(a.sale))).slice(0, 4);
      if (gridByKey.bestseller) gridByKey.bestseller.innerHTML = best.map(cardHTML).join('');

      cartBtnRebind();

      // Rebind image modal clicks after DOM updates
      bindProductImageClick();
    });
}

function bindProductImageClick() {
  // Target actual card images
  document.querySelectorAll('.sale-card img').forEach(img => {
    img.style.cursor = 'pointer';

    // Avoid double-binding
    if (img.dataset.modalBound === 'true') return;
    img.dataset.modalBound = 'true';

    img.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const card = img.closest('.sale-card');
      if (!card) return;

      const name = card.querySelector('.sale-name')?.textContent?.trim() || img.getAttribute('alt') || '';
      const category = card.closest('.sale-products')?.querySelector('.sale-products-title')?.textContent?.trim() || '';

      const oldPrice = card.querySelector('.sale-original')?.textContent?.trim() || '';
      const price = card.querySelector('.sale-discount')?.textContent?.trim() || '';
      const imageSrc = img.getAttribute('src') || '';

      const addBtn = card.querySelector('.add-to-cart');
      const id = addBtn?.getAttribute('data-id') || '';

      // If modal expects numeric price for cart, store the dataset price when available.
      const description = `Premium ${category || 'UNSORTED'} drop. Raw style, built to last.`;

      openProductModal({
        id,
        name,
        price: addBtn?.getAttribute('data-price') || price,
        oldPrice,
        image: addBtn?.getAttribute('data-image') || imageSrc,
        category,
        description,
      });
    });

    // Ensure cart button click doesn't bubble into image modal logic
    const cardAddBtn = img.closest('.sale-card')?.querySelector('.add-to-cart');
    cardAddBtn?.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });
  });
}





