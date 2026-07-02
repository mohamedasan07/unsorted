/* Razorpay checkout integration (frontend)

Usage:
- Ensure Razorpay script is reachable.
- Set window.RAZORPAY_KEY_ID to your Razorpay Key Id.
- Create backend endpoints for signature/order_id if you want full security.

This app currently runs without server-side order creation.
For production: use backend to create order with Razorpay Orders API.
*/

(function () {
  const DEFAULT_KEY_ID_FALLBACK = '';

  function getCartTotalFromUI() {
    // cart total is rendered like: "Subtotal: ₹X" in script.js
    const totalEl = document.getElementById('cartTotal');
    if (!totalEl) return 0;
    const text = totalEl.textContent || '';
    const match = text.replace(/,/g, '').match(/₹\s*([0-9]+(?:\.[0-9]+)?)/);
    return match ? Math.round(Number(match[1])) : 0;
  }

  function ensureRazorpayLoaded() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(window.Razorpay);

      const existing = document.querySelector('script[data-razorpay="true"]');
      if (existing && existing.getAttribute('data-status') === 'loading') {
        existing.addEventListener('load', () => resolve(window.Razorpay));
        existing.addEventListener('error', reject);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.setAttribute('data-razorpay', 'true');
      script.setAttribute('data-status', 'loading');
      script.onload = () => {
        script.setAttribute('data-status', 'loaded');
        if (!window.Razorpay) return reject(new Error('Razorpay SDK loaded but window.Razorpay missing'));
        resolve(window.Razorpay);
      };
      script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
      document.head.appendChild(script);
    });
  }

  function getKeyId() {
    // Prefer window.RAZORPAY_KEY_ID if you set it.
    return window.RAZORPAY_KEY_ID || DEFAULT_KEY_ID_FALLBACK;
  }

  async function startRazorpayPayment({ amountINR, cart }) {
    const keyId = getKeyId();
    if (!keyId) {
      alert('Razorpay Key Id is missing. Set window.RAZORPAY_KEY_ID in index.html or checkout script.');
      return;
    }

    // This demo uses client-side order creation fallback.
    // For production, create an order on backend and use order_id.
    // Razorpay checkout.js supports `order_id`.
    // Here we use a pseudo order_id if none; checkout will reject.

    const amountPaise = Math.round(Number(amountINR) * 100);

    const options = {
      key: keyId,
      // NOTE: In production you must use `order_id` created on your backend.
      // This fallback includes `amount` only.
      amount: amountPaise,
      currency: 'INR',

      name: 'UNSORTED',
      description: 'Cart Checkout',
      // NOTE: For real payments, you should provide order_id from backend.
      // If you already have order_id, pass it here.
      // order_id: 'order_...',
      prefill: {
        name: 'Customer',
        email: 'customer@example.com',
        contact: '9999999999'
      },
      notes: {
        cartSize: String(cart.length || 0)
      },
      theme: {
        color: '#ff4757'
      },
      handler: function (response) {
        // response: razorpay_payment_id, razorpay_order_id, razorpay_signature
        // In production: verify signature server-side.
        alert('Payment successful! Payment ID: ' + (response.razorpay_payment_id || ''));

        // Clear local cart
        localStorage.removeItem('theunsorted_cart');
        // Refresh page to reset UI
        location.reload();
      },
      modal: {
        ondismiss: function () {
          // optional
        }
      }
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      alert('Payment failed: ' + (resp.error && resp.error.description ? resp.error.description : 'Unknown error'));
    });

    rzp.open();
  }

  async function bindRazorpayCheckout() {
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const cart = JSON.parse(localStorage.getItem('theunsorted_cart')) || [];
      if (!cart.length) {
        alert('Your cart is empty');
        return;
      }

      const amountINR = getCartTotalFromUI();
      if (!amountINR || amountINR <= 0) {
        alert('Invalid cart total');
        return;
      }

      try {
        await ensureRazorpayLoaded();
        await startRazorpayPayment({ amountINR, cart });
      } catch (err) {
        alert('Razorpay checkout error: ' + (err && err.message ? err.message : String(err)));
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindRazorpayCheckout);
  } else {
    bindRazorpayCheckout();
  }
})();

