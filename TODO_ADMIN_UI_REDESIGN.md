# TODO_ADMIN_UI_REDESIGN

- [ ] Update `admin/index.html`:
  - [ ] Replace Dashboard heading/subtitle with premium hero copy (UNSORTED CONTROL CENTER / UNSORTED ADMIN OPS).
  - [ ] Enlarge UNSORTED logo lockup in sidebar.
  - [ ] Add IDs/classes needed for hero styling while keeping existing DOM hooks for JS (`#viewTitle`, `data-view-container`, etc.).

- [ ] Update `admin/admin.js`:
  - [ ] UI-only: set dashboard hero text via the existing `#viewTitle` (or corresponding hero element) without changing any API logic.

- [ ] Update `admin/admin.css`:
  - [ ] Implement premium matte-black sidebar with thinner borders + stronger hover.
  - [ ] Redesign metric cards as compact black-glass analytics with subtle borders and hover lift.
  - [ ] Unify buttons: white outline, transparent/black fill, hover invert.
  - [ ] Add smooth premium transitions + modal/hover animations.
  - [ ] Add pill-like styling hooks for order status/payment selects.

- [ ] Sanity check manually:
  - [ ] Login page still styled.
  - [ ] Dashboard loads and stats render.
  - [ ] Products CRUD works (modal open/close, save/delete).
  - [ ] Orders update works.
  - [ ] Users delete + search works.

