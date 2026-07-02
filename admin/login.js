console.log('login.js loaded');

async function apiPost(url, body) {
  console.log('[login.js] apiPost ->', url, body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || 'Login failed';
    throw new Error(msg);
  }
  return data;
}

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');

console.log('[login.js] form found?', !!form);
console.log('[login.js] errorEl found?', !!errorEl);

if (!form) {
  console.error('[login.js] Missing #loginForm; aborting');
} else {
  form.addEventListener('submit', async (e) => {
    console.log('[login.js] submit fired');

    // Prevent normal submit navigation/reload
    e.preventDefault();
    console.log('[login.js] preventDefault called');

    if (errorEl) errorEl.hidden = true;

    const email = form.email?.value?.trim?.() ?? '';
    const password = form.password?.value ?? '';

    console.log('[login.js] credentials', { email, passwordProvided: !!password });

    try {
      const data = await apiPost('/admin/login', { email, password });
      console.log('[login.js] /admin/login response:', data);

      if (data?.success === true || data?.ok === true) {
        console.log('[login.js] login success -> redirect /admin');
        window.location.href = '/admin';
        return;
      }

      console.warn('[login.js] login not successful:', data);
      throw new Error(data?.error || 'Login failed');
    } catch (err) {
      console.error('[login.js] login error:', err);
      if (errorEl) {
        errorEl.textContent = err?.message || 'Login failed';
        errorEl.hidden = false;
      }
    }
  });
}





