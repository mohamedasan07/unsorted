# TODO_IMAGES_FIX

- [ ] Inspect backend/seed.json product list and identify products with missing/empty/broken image URLs or broken local paths.
- [ ] Decide replacement URL for each category keyword rule:
  - t-shirt -> tshirt image
  - knit -> knitwear image
  - sunglasses -> sunglasses image
  - backpack -> backpack image
- [ ] Update only backend/seed.json product data source fields (use `image` since backend normalizes to `imageUrl`).
- [ ] Ensure no UI code changes are made.
- [ ] Re-run quick sanity check: start backend and verify /products returns updated image urls.

