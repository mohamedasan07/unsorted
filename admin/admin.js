function $(sel) { return document.querySelector(sel); }
function elById(id) { return document.getElementById(id); }

const sidebarLinks = Array.from(document.querySelectorAll('.admin-nav-link'));
const viewContainers = Array.from(document.querySelectorAll('[data-view-container]'));
const viewTitle = elById('viewTitle');

function setView(view) {
  sidebarLinks.forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  viewContainers.forEach(v => {
    const key = v.getAttribute('data-view-container');
    v.hidden = key !== view;
  });

  if (view === 'dashboard') {
    // UI-only hero copy
    if (viewTitle) viewTitle.textContent = 'Dashboard';
  } else {

    if (viewTitle) {
      const pretty = view.charAt(0).toUpperCase() + view.slice(1);
      viewTitle.textContent = pretty;
    }
  }
}


function fmtMoney(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '₹0';
  return '₹' + n.toLocaleString('en-IN');
}

function fmtStock(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return String(n);
}

function fmtBool(v) {
  return Boolean(v) ? 'Yes' : 'No';
}

function safeText(v) {
  return String(v ?? '');
}


sidebarLinks.forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const view = a.dataset.view;
    setView(view);
    loadIfNeeded(view);
  });
});

const API = {
  products: '/api/products',
  orders: '/api/orders',
  users: '/api/users'
};

async function apiJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    },
    credentials: 'include'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

function renderProducts(list) {
  const tbody = elById('productsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  list.forEach(p => {
    const tr = document.createElement('tr');
    const stockQty = Number(p.stockQuantity || 0);
    const stockClass = stockQty <= 5 ? 'color:#ff4757;font-weight:900;' : 'color:rgba(255,255,255,0.7);';

    tr.innerHTML = `
      <td>${p.id}</td>
      <td>
        <strong>${escapeHtml(p.name)}</strong>
        <div class="admin-muted" style="font-size:0.85em;margin-top:2px;">${escapeHtml(p.category || '—')}</div>
      </td>
      <td>
        <div>₹${Number(p.price || 0).toLocaleString('en-IN')}</div>
        ${p.oldPrice ? `<div class="admin-muted" style="text-decoration:line-through;font-size:0.85em;">₹${Number(p.oldPrice).toLocaleString('en-IN')}</div>` : ''}
      </td>
      <td><span style="${stockClass}">${stockQty}</span></td>
      <td>${p.sale ? '<span style="color:#2ed573;font-weight:900;">Yes</span>' : '<span class="admin-muted">No</span>'}</td>
      <td>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="admin-btn-secondary" type="button" data-action="edit" data-id="${p.id}"><i class="fa-solid fa-pen"></i><span>Edit</span></button>
          <button class="admin-btn-secondary" type="button" data-action="delete" data-id="${p.id}" style="border-color: rgba(255,71,87,0.35); background: rgba(255,71,87,0.08);"><i class="fa-solid fa-trash"></i><span>Delete</span></button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openProductModal('edit', btn.dataset.id));
  });
  tbody.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('Delete product #' + id + '?')) return;
      await apiJson(`${API.products}/${id}`, { method: 'DELETE' });
      await refreshProducts();
    });
  });
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

// Product modal
const modal = elById('productModal');
const productModalTitle = elById('productModalTitle');
const closeBtn = elById('productModalCloseBtn');
const cancelBtn = elById('productCancelBtn');
const productForm = elById('productForm');
const errorEl = elById('productFormError');

const productIdEl = elById('productId');
const nameEl = elById('productName');
const priceEl = elById('productPrice');
const imageUrlEl = elById('productImageUrl');

function openModal() { modal?.classList.add('active'); modal?.setAttribute('aria-hidden', 'false'); }
function closeModal() { modal?.classList.remove('active'); modal?.setAttribute('aria-hidden', 'true'); }

closeBtn?.addEventListener('click', closeModal);
cancelBtn?.addEventListener('click', closeModal);
modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

let currentMode = 'add';
let currentEditId = null;

const categoryEl = elById('productCategory');
const descriptionEl = elById('productDescription');
const oldPriceEl = elById('productOldPrice');
const stockQuantityEl = elById('productStockQuantity');
const saleEl = elById('productSale');

async function openProductModal(mode, id) {
  currentMode = mode;
  currentEditId = id;
  errorEl.hidden = true;

  if (mode === 'add') {
    productModalTitle.textContent = 'Add Product';
    productIdEl.value = '';
    nameEl.value = '';
    priceEl.value = '';
    imageUrlEl.value = '';

    categoryEl && (categoryEl.value = '');
    descriptionEl && (descriptionEl.value = '');
    oldPriceEl && (oldPriceEl.value = '');
    stockQuantityEl && (stockQuantityEl.value = '');
    saleEl && (saleEl.checked = false);

    openModal();
    return;
  }

  const products = await apiJson(API.products);
  const p = products.find(x => String(x.id) === String(id));
  if (!p) {
    alert('Product not found');
    return;
  }

  productModalTitle.textContent = 'Edit Product #' + p.id;
  productIdEl.value = p.id;
  nameEl.value = safeText(p.name);
  priceEl.value = p.price ?? '';
  imageUrlEl.value = safeText(p.imageUrl);

  categoryEl && (categoryEl.value = safeText(p.category));
  descriptionEl && (descriptionEl.value = safeText(p.description));
  oldPriceEl && (oldPriceEl.value = p.oldPrice ?? '');
  stockQuantityEl && (stockQuantityEl.value = p.stockQuantity ?? '');
  saleEl && (saleEl.checked = Boolean(p.sale));

  openModal();
}

elById('newProductBtn')?.addEventListener('click', () => openProductModal('add'));

productForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;

  const name = nameEl.value.trim();
  const price = Number(priceEl.value);
  const oldPrice = Number(oldPriceEl?.value);
  const stockQuantity = Number(stockQuantityEl?.value);
  const imageUrl = imageUrlEl.value.trim();

  const category = categoryEl?.value?.trim?.() ?? '';
  const description = descriptionEl?.value?.trim?.() ?? '';
  const sale = Boolean(saleEl?.checked);

  try {
    if (currentMode === 'add') {
      await apiJson(API.products, {
        method: 'POST',
        body: JSON.stringify({ name, description, category, price, oldPrice, stockQuantity, sale, imageUrl })
      });
    } else {
      const id = productIdEl.value;
      await apiJson(`${API.products}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, description, category, price, oldPrice, stockQuantity, sale, imageUrl })
      });
    }

    closeModal();
    await refreshProducts();
  } catch (err) {
    errorEl.textContent = err.message || 'Save failed';
    errorEl.hidden = false;
  }
});


async function refreshProducts() {
  const list = await apiJson(API.products);
  renderProducts(list);
}

// Orders / Users
async function loadOrders() {
  const data = await apiJson(API.orders);
  const tbody = elById('ordersTbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  const orders = Array.isArray(data?.orders) ? data.orders : [];

  orders.forEach(o => {
    const tr = document.createElement('tr');
    const itemsCount = Array.isArray(o?.items) ? o.items.reduce((sum,it)=> sum + Number(it?.quantity || 0), 0) : 0;

    const payment = safeText(o?.paymentStatus || 'pending');
    const status = safeText(o?.orderStatus || 'pending');
    const updateId = safeText(o?.id);

    tr.innerHTML = `
      <td>${escapeHtml(updateId)}</td>
      <td>${escapeHtml(o?.customerName || o?.customerEmail || '—')}</td>
      <td>${escapeHtml(String(itemsCount))}</td>
      <td>${escapeHtml(payment)}</td>
      <td>${escapeHtml(status)}</td>
      <td>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <select class="admin-select" data-action="payment" data-id="${escapeHtml(updateId)}" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.10); color:#fff; padding:10px 12px; border-radius:14px;">
            <option value="pending" ${payment==='pending'?'selected':''}>pending</option>
            <option value="paid" ${payment==='paid'?'selected':''}>paid</option>
            <option value="failed" ${payment==='failed'?'selected':''}>failed</option>
          </select>
          <select class="admin-select" data-action="status" data-id="${escapeHtml(updateId)}" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.10); color:#fff; padding:10px 12px; border-radius:14px;">
            <option value="pending" ${status==='pending'?'selected':''}>pending</option>
            <option value="shipped" ${status==='shipped'?'selected':''}>shipped</option>
            <option value="delivered" ${status==='delivered'?'selected':''}>delivered</option>
            <option value="cancelled" ${status==='cancelled'?'selected':''}>cancelled</option>
          </select>
          <button class="admin-btn-secondary" type="button" data-action="updateOrder" data-id="${escapeHtml(updateId)}" style="padding:10px 12px;">
            <i class="fa-solid fa-rotate"></i>
            <span>Update</span>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!orders.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="6" class="admin-muted">No orders found.</td>`;
    tbody.appendChild(tr);
    return;
  }

  tbody.querySelectorAll('button[data-action="updateOrder"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const paymentSel = tbody.querySelector(`select[data-id="${CSS.escape(id)}"][data-action="payment"]`);
      const statusSel = tbody.querySelector(`select[data-id="${CSS.escape(id)}"][data-action="status"]`);
      const paymentStatus = paymentSel?.value || 'pending';
      const orderStatus = statusSel?.value || 'pending';

      await apiJson(`${API.orders}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ paymentStatus, orderStatus })
      });
      await loadOrders();
    });
  });
}

async function loadUsers() {
  const data = await apiJson(API.users);
  const tbody = elById('usersTbody');
  if (!tbody) return;

  const users = Array.isArray(data?.users) ? data.users : [];

  function render(list) {
    tbody.innerHTML = '';
    list.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(u?.id)}</td>
        <td>${escapeHtml(u?.name || 'User')}</td>
        <td>${escapeHtml(u?.role || 'customer')}</td>
        <td>
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <button class="admin-btn-secondary" type="button" data-action="deleteUser" data-id="${escapeHtml(u?.id)}" style="border-color: rgba(255,71,87,0.35); background: rgba(255,71,87,0.08); padding:10px 12px;">
              <i class="fa-solid fa-trash"></i>
              <span>Delete</span>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="4" class="admin-muted">No users found.</td>`;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('button[data-action="deleteUser"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (!confirm('Delete user #' + id + '?')) return;
        await apiJson(`${API.users}/${id}`, { method: 'DELETE' });
        await loadUsers();
      });
    });
  }

  // Search (client-side)
  const searchInput = elById('userSearch');
  const query = () => safeText(searchInput?.value || '').trim().toLowerCase();
  const applySearch = () => {
    const q = query();
    if (!q) return render(users);
    const filtered = users.filter(u => {
      const name = safeText(u?.name).toLowerCase();
      const email = safeText(u?.email).toLowerCase();
      return name.includes(q) || email.includes(q);
    });
    render(filtered);
  };

  if (searchInput) {
    searchInput.oninput = applySearch;
  }
  applySearch();
}


async function loadDashboardStats() {
  const productsRes = await apiJson(API.products);
  const ordersRes = await apiJson(API.orders);
  const usersRes = await apiJson(API.users);

  const products = Array.isArray(productsRes) ? productsRes : [];
  const orders = Array.isArray(ordersRes?.orders) ? ordersRes.orders : [];
  const users = Array.isArray(usersRes?.users) ? usersRes.users : [];

  const statProducts = elById('statProducts');
  const statOrders = elById('statOrders');
  const statUsers = elById('statUsers');
  const statRevenue = elById('statRevenue');

  const chartInventory = elById('chartInventory');
  const chartRecentOrders = elById('chartRecentOrders');
  const chartLowStock = elById('chartLowStock');

  const recentOrdersEl = elById('recentOrders');
  const bestSellersEl = elById('bestSellers');
  const lowStockEl = elById('lowStock');

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o?.totalRevenue || 0), 0);

  const activeInventory = products.reduce((sum, p) => sum + (Number(p?.stockQuantity || 0) > 0 ? Number(p.stockQuantity || 0) : 0), 0);
  const lowStockThreshold = 5;
  const lowStockSkus = products.filter(p => Number(p?.stockQuantity || 0) <= lowStockThreshold);

  // Best sellers by ordered quantity
  const qtyByProduct = new Map();
  orders.forEach(o => {
    (o?.items || []).forEach(it => {
      const pid = String(it?.productId ?? it?.product?.id ?? '');
      if (!pid) return;
      const q = Number(it?.quantity || 0);
      qtyByProduct.set(pid, (qtyByProduct.get(pid) || 0) + q);
    });
  });
  const bestSellerEntries = [...qtyByProduct.entries()].sort((a,b) => b[1]-a[1]).slice(0, 5);
  const bestSellers = bestSellerEntries.map(([pid, qty]) => {
    const p = products.find(x => String(x?.id) === String(pid));
    return { product: p, qty };
  });

  // Recent orders list
  const recentOrders = orders.slice().sort((a,b) => (b?.createdAt||'').localeCompare(a?.createdAt||'')).slice(0, 5);

  if (statProducts) statProducts.textContent = String(products.length);
  if (statOrders) statOrders.textContent = String(orders.length);
  if (statUsers) statUsers.textContent = String(users.length);
  if (statRevenue) statRevenue.textContent = fmtMoney(totalRevenue);

  if (chartInventory) chartInventory.textContent = fmtStock(activeInventory);
  if (chartRecentOrders) chartRecentOrders.textContent = String(Math.min(orders.length, 5));
  if (chartLowStock) chartLowStock.textContent = String(lowStockSkus.length);

  if (recentOrdersEl) {
    recentOrdersEl.innerHTML = '';
    recentOrders.forEach(o => {
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div style="font-weight:950;">Order #${safeText(o?.id)}</div>
        <div class="admin-muted" style="margin-top:6px;">${safeText(o?.customerName || o?.customerEmail || '—')}</div>
        <div class="admin-muted" style="margin-top:6px;">Payment: ${safeText(o?.paymentStatus || '—')} · Status: ${safeText(o?.orderStatus || '—')}</div>
        <div style="margin-top:10px; font-weight:950;">${fmtMoney(o?.totalRevenue)}</div>
      `;
      recentOrdersEl.appendChild(div);
    });
    if (!recentOrders.length) recentOrdersEl.innerHTML = '<div class="admin-muted">No orders yet.</div>';
  }

  if (bestSellersEl) {
    bestSellersEl.innerHTML = '';
    bestSellers.forEach(({ product: p, qty }) => {
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div style="font-weight:950;">${safeText(p?.name || 'Unknown product')}</div>
        <div class="admin-muted" style="margin-top:6px;">Ordered: ${fmtStock(qty)}</div>
        <div class="admin-muted" style="margin-top:6px;">${fmtMoney(p?.price)}</div>
      `;
      bestSellersEl.appendChild(div);
    });
    if (!bestSellers.length) bestSellersEl.innerHTML = '<div class="admin-muted">No best sellers yet.</div>';
  }

  if (lowStockEl) {
    lowStockEl.innerHTML = '';
    lowStockSkus.slice(0, 6).forEach(p => {
      const div = document.createElement('div');
      div.className = 'admin-list-item';
      div.innerHTML = `
        <div style="font-weight:950;">${safeText(p?.name || 'Unknown product')}</div>
        <div class="admin-muted" style="margin-top:6px;">Stock: ${fmtStock(p?.stockQuantity)}</div>
        <div class="admin-muted" style="margin-top:6px;">${fmtMoney(p?.price)}</div>
      `;
      lowStockEl.appendChild(div);
    });
    if (!lowStockSkus.length) lowStockEl.innerHTML = '<div class="admin-muted">All good — stock is healthy.</div>';
  }
}


let loaded = { dashboard:false, products:false, orders:false, users:false };
async function loadIfNeeded(view) {
  if (loaded[view]) return;
  if (view === 'dashboard') {
    await loadDashboardStats();
  }
  if (view === 'products') {
    await refreshProducts();
  }
  if (view === 'orders') {
    await loadOrders();
  }
  if (view === 'users') {
    await loadUsers();
  }
  loaded[view] = true;
}

// Logout
elById('logoutBtn')?.addEventListener('click', async () => {
  try {
    await apiJson('/admin/logout', { method: 'POST' });
  } finally {
    window.location.href = '/admin/login';
  }
});

// Initial
setView('dashboard');
loadIfNeeded('dashboard').catch(err => {
  alert(err.message || 'Failed to load dashboard');
});

