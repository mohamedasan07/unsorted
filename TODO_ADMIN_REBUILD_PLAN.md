# TODO_ADMIN_REBUILD_PLAN

## Backend (persistence + APIs)
- [ ] Create `backend/db.json` persistent store.
- [ ] Migrate existing `backend/seed.json` products into `backend/db.json` on first run.
- [ ] Extend product schema: `id, name, description, category, price, oldPrice, imageUrl, stockQuantity, sale`.
- [ ] Extend order schema: `id, customerName, customerEmail, items[], paymentStatus, orderStatus, totalRevenue, createdAt`.
- [ ] Extend user schema: `id, name, email, role`.
- [ ] Implement required APIs:
  - [ ] `GET /api/products`
  - [ ] `POST /api/products`
  - [ ] `PUT /api/products/:id`
  - [ ] `DELETE /api/products/:id`
  - [ ] `GET /api/orders`
  - [ ] `PUT /api/orders/:id`
  - [ ] `GET /api/users`
  - [ ] `DELETE /api/users/:id`
- [ ] Ensure every API response is fully normalized (no `undefined` fields).
- [ ] Ensure customer storefront continues to work using existing `/products` response fields.

## Admin UI (premium theme + real data)
- [ ] Redesign `admin/index.html` views:
  - [ ] Dashboard metrics: Total Products, Total Orders, Total Users, Total Revenue, Active Inventory, Recent Orders, Low Stock Alerts, Best Selling Products.
  - [ ] Products CRUD page with full form fields + instant save.
  - [ ] Orders view with status update (pending/shipped/delivered/cancelled).
  - [ ] Users view with search, delete, and order history modal.
- [ ] Rebuild `admin/admin.js` to:
  - [ ] Use real persisted data from updated APIs.
  - [ ] Remove all demo text and all `undefined` rendering.
  - [ ] Add safe formatting helpers.
- [ ] Refine `admin/admin.css` to match UNSORTED premium dark luxury theme (glassmorphism, glowing borders, responsive, smooth transitions).

## Verification
- [ ] Start backend and verify all required endpoints.
- [ ] Add product in admin and confirm it appears on customer site immediately.
- [ ] Edit/delete product in admin and confirm customer site updates/removes it.
- [ ] Manual checks: orders status update, user search/delete, dashboard metrics non-undefined.

