# UNSORTED Backend (Node.js + Express)

## Setup

a) Install dependencies
```bash
cd backend
npm i
```

b) Run
```bash
npm run dev
```

Backend runs at:
- `http://localhost:3001`

## API
- `GET /products`
- `POST /cart` body: `{ productId, quantity }`
- `PUT /cart/:id` body: `{ quantity }` (id is `productId`)
- `DELETE /cart/:id` (id is `productId`)

