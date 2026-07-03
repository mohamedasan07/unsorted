// =====================
// cart.js — Cart state management
// =====================

import { formatINR, handleImageError } from './utils.js';
import { syncCartItem } from './api.js';

const STORAGE_KEY = 'theunsorted_cart';

// =====================
// State
// =====================
let cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

function persistCart() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
}

// =====================
// Public API
// =====================

export function getCart() {
  return cart;
}

export function addToCart(product) {
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

  persistCart();
  updateCartBadge();
  renderCart();

  // Best-effort backend sync
  syncCartItem(product.id, 1);
}

export function setCartQuantity(productId, nextQty) {
  const qty = Math.max(0, Number(nextQty));

  cart = cart.map(item => {
    if (String(item.id) !== String(productId)) return item;
    return { ...item, quantity: qty };
  }).filter(item => item.quantity > 0);

  persistCart();
  updateCartBadge();
  renderCart();
}

export function removeFromCart(id) {
  setCartQuantity(id, 0);
}

export function getCartTotal() {
  return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// =====================
// Badge
// =====================

export function updateCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = totalItems || '0';
    badge.style.display = totalItems > 0 ? 'flex' : 'none';
  }
}

// =====================
// Cart Sidebar Rendering
// =====================

export function renderCart() {
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
        <img src="${imgSrc}" alt="${item.name}" loading="lazy">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
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

export function toggleCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  const next = !sidebar?.classList.contains('active');

  sidebar?.classList.toggle('active', next);
  overlay?.setAttribute('aria-hidden', next ? 'false' : 'true');
  overlay?.classList.toggle('active', next);

  if (next) renderCart();
}

function closeCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  sidebar?.classList.remove('active');
  overlay?.setAttribute('aria-hidden', 'true');
  overlay?.classList.remove('active');
}

export function bindCartControls() {
  const overlay = document.getElementById('cartOverlay');
  const closeBtn = document.getElementById('cartCloseBtn');
  const cartItems = document.getElementById('cartItems');

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

  // ESC key closes cart
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const sidebar = document.getElementById('cartSidebar');
      if (sidebar?.classList.contains('active')) closeCart();
    }
  });
}

// =====================
// Checkout (Razorpay integration)
// =====================

function getCartTotalFromUI() {
  const totalEl = document.getElementById('cartTotal');
  if (!totalEl) return 0;
  const text = totalEl.textContent || '';
  const match = text.replace(/,/g, '').match(/₹\s*([0-9]+(?:\.[0-9]+)?)/);
  return match ? Math.round(Number(match[1])) : 0;
}

function ensureRazorpayLoaded() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      if (!window.Razorpay) return reject(new Error('Razorpay SDK missing'));
      resolve(window.Razorpay);
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}

export function bindCheckout() {
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (!checkoutBtn) return;

  checkoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    if (!cart.length) {
      alert('Your cart is empty');
      return;
    }

    const amountINR = getCartTotalFromUI();
    if (!amountINR || amountINR <= 0) {
      alert('Invalid cart total');
      return;
    }

    const keyId = window.RAZORPAY_KEY_ID || '';
    if (!keyId) {
      alert('Payment is not configured. Set RAZORPAY_KEY_ID.');
      return;
    }

    try {
      await ensureRazorpayLoaded();

      const options = {
        key: keyId,
        amount: Math.round(amountINR * 100),
        currency: 'INR',
        name: 'UNSORTED',
        description: 'Cart Checkout',
        prefill: { name: 'Customer', email: 'customer@example.com', contact: '9999999999' },
        theme: { color: '#ff4757' },
        handler: function (response) {
          alert('Payment successful! Payment ID: ' + (response.razorpay_payment_id || ''));
          localStorage.removeItem(STORAGE_KEY);
          location.reload();
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (resp) => {
        alert('Payment failed: ' + (resp.error?.description || 'Unknown error'));
      });
      rzp.open();
    } catch (err) {
      alert('Checkout error: ' + (err?.message || String(err)));
    }
  });
}
