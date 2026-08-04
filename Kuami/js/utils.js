/* ============================================================
   js/utils.js — Helpers compartidos entre páginas
   Carrito (localStorage), formateo, toast, notificaciones stock
   ============================================================ */

/* ── Constantes ── */
const CART_KEY   = 'carritoKuami';
const NOTIFY_KEY = 'kuami_notificaciones'; // { productId: { channel, contact, name, ts } }
const PHONE_WA   = '595984024413';

/* ── Carrito ── */
function getCart()     { return JSON.parse(localStorage.getItem(CART_KEY)   || '[]');  }
function setCart(c)    { localStorage.setItem(CART_KEY,   JSON.stringify(c)); }

/* ── Notificaciones de stock ── */
function getNotify()   { return JSON.parse(localStorage.getItem(NOTIFY_KEY) || '{}');  }
function setNotify(n)  { localStorage.setItem(NOTIFY_KEY, JSON.stringify(n)); }

/**
 * Guardar solicitud de aviso de stock.
 * @param {string} productId
 * @param {string} productName
 * @param {'wa'|'email'} channel
 * @param {string} contact  — número WA o email
 */
function saveNotifyRequest(productId, productName, channel, contact) {
  const store = getNotify();
  store[productId] = {
    productId,
    productName,
    channel,
    contact,
    ts: new Date().toISOString()
  };
  setNotify(store);
}

/** Devuelve la solicitud existente para un producto, o null */
function getNotifyForProduct(productId) {
  return getNotify()[productId] || null;
}

/** Exportar todas las notificaciones como JSON (para el admin) */
function exportNotifications() {
  return JSON.parse(localStorage.getItem(NOTIFY_KEY) || '{}');
}

/* ── Formateo ── */
function formatGs(n) {
  return 'Gs. ' + (n || 0).toLocaleString('es-PY');
}

/* ── Badge del carrito ── */
function updateCartBadge() {
  const n = getCart().reduce((a, i) => a + (Number(i.qty) || 0), 0);
  document.querySelectorAll('#cartCount').forEach(el => {
    el.textContent = n;
    el.classList.add('bump');
    setTimeout(() => el.classList.remove('bump'), 220);
  });
}

/* ── Toast ── */
function showToast(msg = 'Agregado al carrito', type = 'success') {
  const el    = document.getElementById('addToast');
  const msgEl = document.getElementById('toastMsg');
  if (!el || !msgEl) return;

  // Ajustar color según tipo
  el.className = el.className
    .replace(/text-bg-\w+/, '')
    .replace(/border-0/, '')
    .trim();
  el.classList.add(`text-bg-${type}`, 'border-0');

  msgEl.textContent = msg;
  const t = bootstrap.Toast.getOrCreateInstance(el, { delay: 1800 });
  t.show();
}

/* ── Añadir al carrito ── */
function addToCart(item) {
  const cart  = getCart();
  const found = cart.find(p =>
    p.id === item.id &&
    (p.variantKey || '') === (item.variantKey || '')
  );
  const addQty = Math.max(1, parseInt(item.qty, 10) || 1);

  if (found) {
    found.qty += addQty;
    if (typeof item.totalLine === 'number') {
      found.totalLine = (found.totalLine || 0) + item.totalLine;
      found.detail    = item.detail || found.detail;
    }
  } else {
    cart.push({ ...item, qty: addQty });
  }

  setCart(cart);
  updateCartBadge();
  showToast(`${item.name} agregado`);
}

/* ── Helpers de cálculo de línea (carrito) ── */
function calcLine(item) {
  const qty        = Math.max(1, parseInt(item.qty, 10) || 1);
  const unit       = Math.max(0, parseInt(item.price, 10) || 0);
  const comboPrice = Math.max(0, parseInt(item.comboPrice, 10) || 0);

  if (item.mode === 'promo' && comboPrice > 0) {
    const combos = Math.floor(qty / 25);
    const resto  = qty % 25;
    const total  = (combos * comboPrice) + (resto * unit);
    const detail = `${combos} combo(s) de 25 + ${resto} unitarias`;
    return { qty, unit, comboPrice, combos, resto, total, detail };
  }

  const total  = qty * unit;
  const detail = item.mode ? `${qty} unitarias` : '';
  return { qty, unit, comboPrice: 0, combos: 0, resto: qty, total, detail };
}

/* ── Año footer ── */
function setFooterYear() {
  document.querySelectorAll('#yy').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
}

/* Exportar globalmente para que los otros scripts los usen */
window.KuamiUtils = {
  CART_KEY, NOTIFY_KEY, PHONE_WA,
  getCart, setCart,
  getNotify, setNotify, saveNotifyRequest, getNotifyForProduct, exportNotifications,
  formatGs,
  updateCartBadge,
  showToast,
  addToCart,
  calcLine,
  setFooterYear
};
