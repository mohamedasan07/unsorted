// =====================
// utils.js — Shared utility functions
// =====================

/**
 * Format a number as Indian Rupees (₹)
 */
const INR_FORMATTER = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatINR(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '₹0';
  return INR_FORMATTER.format(num);
}

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}

/**
 * Generate a placeholder SVG data URI for broken images
 */
export function placeholderImage(text = '?') {
  const letter = escapeHtml(String(text).charAt(0).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#1a1a1a"/>
    <rect x="0" y="0" width="400" height="400" fill="url(#grad)" opacity="0.3"/>
    <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#ff4757;stop-opacity:0.4"/>
      <stop offset="100%" style="stop-color:#ff6b81;stop-opacity:0.1"/>
    </linearGradient></defs>
    <text x="200" y="215" font-family="Inter,system-ui,sans-serif" font-size="80" font-weight="900" fill="rgba(255,255,255,0.2)" text-anchor="middle">${letter}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Handle broken image by setting a placeholder
 */
export function handleImageError(img, name = '') {
  img.onerror = null; // prevent infinite loop
  img.src = placeholderImage(name);
}
