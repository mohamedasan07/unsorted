// Checkout patch: attaches handler for #checkoutBtn
// Loads after script.js.

(function () {
  function bindCheckout() {
    const btn = document.getElementById('checkoutBtn');
    if (!btn) return;

    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Best-effort total from UI/backend cart
      const cart = JSON.parse(localStorage.getItem('theunsorted_cart')) || [];
      if (!cart.length) {
        alert('Your cart is empty');
        return;
      }

      const API_BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://unsorted-backend.onrender.com';

      // Optional: sync cart to backend (simple strategy: push each item)
      // Backend cart is in-memory and keyed by productId.
      try {
        for (const item of cart) {
          await fetch(`${API_BASE}/cart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: item.id, quantity: item.quantity || 1 })
          });
        }
      } catch (err) {
        // ignore; still allow demo checkout
      }

      // Razorpay integration is handled by razorpay_checkout.js
      // (This file used to show demo alert; keep this handler to avoid conflicts.)
      return;

    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCheckout);
  } else {
    bindCheckout();
  }
})();

