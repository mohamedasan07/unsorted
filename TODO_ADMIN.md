# Admin Panel Implementation TODO

- [ ] Create admin frontend pages under `/admin/`
  - [ ] `admin/index.html` (dashboard layout + sidebar)
  - [ ] `admin/login.html` (premium dark login)
  - [ ] `admin/admin.css` (branding + sidebar)
  - [ ] `admin/admin.js` (auth-protected app shell: fetch analytics/products/orders/users)
  - [ ] `admin/login.js` (login form submit)

- [ ] Update backend `backend/server.js`
  - [ ] Add session support (cookie) and admin auth middleware
  - [ ] Add routes:
    - [ ] `GET /admin` (serve dashboard; protect)
    - [ ] `GET /admin/login` (serve login)
    - [ ] `POST /admin/login` (authenticate + create session)
    - [ ] `POST /admin/logout` (clear session)
  - [ ] Add protected APIs:
    - [ ] `GET/POST/PUT/DELETE /api/products` (CRUD, include imageUrl or upload)
    - [ ] `GET /api/orders` (stub or in-memory)
    - [ ] `GET /api/users` (stub or in-memory)
  - [ ] Add protected image upload for products
    - [ ] `POST /api/products/upload-image` (multipart/form-data) OR accept `image` URL

- [ ] Serve customer and admin frontends separately
  - [ ] Serve static customer site from root (existing `index.html`)
  - [ ] Serve static admin from `/admin`

- [ ] Run backend and verify:
  - [ ] Customer site on `http://localhost:3000`
  - [ ] Admin redirect protection: unauthenticated -> `/admin/login`
  - [ ] Login works and session persists
  - [ ] Product CRUD works from admin UI

