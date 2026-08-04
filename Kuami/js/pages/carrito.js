/* ============================================================
   js/pages/carrito.js
   - Render tabla carrito
   - Cambio cantidad / quitar item
   - Resumen + envío
   - Modal checkout con captcha canvas
   - Generación de código de pedido
   - Apertura de WhatsApp con datos del cliente

   Todo va adentro de una IIFE para que sus variables (getCart,
   formatGs, updateCartBadge, etc.) no choquen con las funciones
   globales que ya define utils.js — mismo motivo que en index.js.
   ============================================================ */
(function () {

const { getCart, setCart, formatGs, calcLine, updateCartBadge, showToast, PHONE_WA } = window.KuamiUtils;

const els = {
  body:        document.getElementById('cartBody'),
  empty:       document.getElementById('empty'),
  count:       document.getElementById('count'),
  subtotal:    document.getElementById('subtotal'),
  ship:        document.getElementById('ship'),
  total:       document.getElementById('total'),
  shippingSel: document.getElementById('shipping'),
  notes:       document.getElementById('notes'),
  waBtn:       document.getElementById('waBtn'),
  clearBtn:    document.getElementById('clearBtn'),
};

/* ── Render ── */
function render() {
  const cart = getCart();
  els.body.innerHTML = '';
  let sub = 0;

  cart.forEach(item => {
    const row  = document.createElement('tr');
    const line = calcLine(item);
    sub += line.total;

    const detailHtml = line.detail
      ? `<div class="small text-secondary">${line.detail}</div>`
      : '';

    row.innerHTML = `
      <td><img class="thumb" src="${item.img}" alt="${item.name}"></td>
      <td class="fw-semibold">${item.name}${detailHtml}</td>
      <td class="text-end">${formatGs(line.unit)}</td>
      <td class="text-center">
        <input type="number" class="form-control form-control-sm qty"
               data-id="${item.id}" value="${line.qty}" min="1">
      </td>
      <td class="text-end">${formatGs(line.total)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-danger rm" data-id="${item.id}" title="Quitar">
          <i class="bi bi-x-lg"></i>
        </button>
      </td>`;
    els.body.appendChild(row);
  });

  const ship = parseInt(els.shippingSel.value, 10) || 0;
  els.subtotal.textContent = formatGs(sub);
  els.ship.textContent     = formatGs(ship);
  els.total.textContent    = formatGs(sub + ship);

  const totalQty = cart.reduce((a, i) => a + (parseInt(i.qty, 10) || 0), 0);
  els.count.textContent = totalQty;

  const empty = cart.length === 0;
  document.getElementById('cartTable').classList.toggle('d-none', empty);
  els.empty.classList.toggle('d-none', !empty);

  buildWA();
}

/* ── Cambiar cantidad ── */
document.addEventListener('input', e => {
  if (!e.target.classList.contains('qty')) return;
  const id  = e.target.dataset.id;
  let val   = parseInt(e.target.value, 10);
  if (!Number.isFinite(val) || val < 1) { val = 1; e.target.value = 1; }
  const cart = getCart();
  const it   = cart.find(i => i.id === id);
  if (it) { it.qty = val; setCart(cart); render(); }
});

/* ── Quitar item ── */
document.addEventListener('click', e => {
  const rmBtn = e.target.closest('.rm');
  if (!rmBtn) return;
  setCart(getCart().filter(i => i.id !== rmBtn.dataset.id));
  render();
});

/* ── Envío ── */
els.shippingSel.addEventListener('change', render);

/* ── Vaciar ── */
els.clearBtn.addEventListener('click', () => {
  if (confirm('¿Vaciar el carrito?')) {
    setCart([]);
    render();
  }
});

/* ── Build WA href ── */
function buildWA() {
  const cart = getCart();
  if (cart.length === 0) { els.waBtn.removeAttribute('href'); els.waBtn.classList.add('disabled'); return; }
  els.waBtn.classList.remove('disabled');

  const ship = parseInt(els.shippingSel.value, 10) || 0;
  const sub  = cart.reduce((a, i) => a + calcLine(i).total, 0);
  const tot  = sub + ship;

  const lines = ['Hola, quiero hacer este pedido:'];
  cart.forEach(i => {
    const line = calcLine(i);
    const det  = line.detail ? ` (${line.detail})` : '';
    lines.push(`• ${i.name} x${line.qty}${det} — ${formatGs(line.total)}`);
  });
  lines.push(`Subtotal: ${formatGs(sub)}`, `Envío: ${formatGs(ship)}`, `Total: ${formatGs(tot)}`);
  const notes = (els.notes.value || '').trim();
  if (notes) lines.push(`Notas: ${notes}`);
  els.waBtn.href = `https://wa.me/${PHONE_WA}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/* ── Captcha Canvas ── */
let captchaText = '';

function randomCaptchaText(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function drawCaptcha(canvas, text) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f8f9fa'; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * .25})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(0,0,0,${.15 + Math.random() * .25})`;
    ctx.lineWidth = 1 + Math.random() * 1.2;
    ctx.beginPath(); ctx.moveTo(Math.random() * w, Math.random() * h);
    ctx.lineTo(Math.random() * w, Math.random() * h); ctx.stroke();
  }
  ctx.font = 'bold 28px Arial'; ctx.textBaseline = 'alphabetic';
  for (let i = 0; i < text.length; i++) {
    const x = 14 + i * 24, y = 36 + (Math.random() * 6 - 3), ang = (Math.random() * .5 - .25);
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = `rgb(${40+Math.random()*80},${40+Math.random()*80},${40+Math.random()*80})`;
    ctx.fillText(text[i], 0, 0); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.strokeRect(.5, .5, w - 1, h - 1);
}

function refreshCaptcha() {
  const canvas = document.getElementById('captchaCanvas');
  if (!canvas) return;
  captchaText = randomCaptchaText(6);
  drawCaptcha(canvas, captchaText);
  const err   = document.getElementById('ckCaptchaErr');
  const input = document.getElementById('ckCaptchaA');
  if (err)   err.classList.add('d-none');
  if (input) input.value = '';
}

/* ── Código de pedido ── */
function randomCode10() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function buildOrderCode(cedula) {
  return `${randomCode10()}-${String(cedula || '').replace(/\D/g, '') || '0'}`;
}

/* ── Mensaje WA con datos del cliente ── */
function buildWAWithCustomer(orderCode, customer) {
  const cart = getCart();
  const ship = parseInt(els.shippingSel.value, 10) || 0;
  const sub  = cart.reduce((a, i) => a + calcLine(i).total, 0);
  const tot  = sub + ship;

  const lines = [
    `Hola soy ${customer.nombre} ${customer.apellido} — He realizado mi pedido en su Página CN°: ${orderCode}`,
    '',
    'Detalle del pedido:'
  ];
  cart.forEach(i => {
    const line = calcLine(i);
    const det  = line.detail ? ` (${line.detail})` : '';
    lines.push(`• ${i.name} x${line.qty}${det} — ${formatGs(line.total)}`);
  });
  lines.push(`Subtotal: ${formatGs(sub)}`, `Envío: ${formatGs(ship)}`, `Total: ${formatGs(tot)}`);
  const notes = (els.notes.value || '').trim();
  if (notes) lines.push('', `Notas: ${notes}`);
  return lines.join('\n');
}

/* ── Checkout ── */
document.addEventListener('DOMContentLoaded', () => {
  const modalCheckoutEl = document.getElementById('modalCheckout');
  const modalOkEl       = document.getElementById('modalPedidoOk');
  if (!modalCheckoutEl || !modalOkEl) return;

  const modalCheckout = new bootstrap.Modal(modalCheckoutEl);
  const modalOk       = new bootstrap.Modal(modalOkEl);

  let lastLink = '';

  const f           = document.getElementById('checkoutForm');
  const ckNombre    = document.getElementById('ckNombre');
  const ckApellido  = document.getElementById('ckApellido');
  const ckTelefono  = document.getElementById('ckTelefono');
  const ckCedula    = document.getElementById('ckCedula');
  const ckCorreo    = document.getElementById('ckCorreo');
  const ckFactura   = document.getElementById('ckFactura');
  const facturaBox  = document.getElementById('facturaBox');
  const ckRuc       = document.getElementById('ckRuc');
  const ckRazon     = document.getElementById('ckRazon');
  const aEl         = document.getElementById('ckCaptchaA');
  const capErr      = document.getElementById('ckCaptchaErr');

  const pedidoOkMsg    = document.getElementById('pedidoOkMsg');
  const pedidoCodigoEl = document.getElementById('pedidoCodigo');
  const btnCopiar      = document.getElementById('btnCopiarCodigo');
  const btnAbrirWA     = document.getElementById('btnAbrirWhatsApp');

  document.getElementById('ckCaptchaRefresh')?.addEventListener('click', refreshCaptcha);

  btnCopiar?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pedidoCodigoEl.value || ''); }
    catch { pedidoCodigoEl.select(); document.execCommand('copy'); }
    btnCopiar.textContent = 'Copiado';
    setTimeout(() => (btnCopiar.textContent = 'Copiar'), 1200);
  });

  let rucTouched = false, razonTouched = false;

  function resetForm() {
    f.classList.remove('was-validated');
    [ckNombre, ckApellido, ckTelefono, ckCedula, ckCorreo].forEach(el => el.value = '');
    ckFactura.checked = false;
    facturaBox.classList.add('d-none');
    ckRuc.value = ''; ckRazon.value = '';
    rucTouched = false; razonTouched = false;
    refreshCaptcha();
  }

  function refreshFacturaDefaults() {
    if (!ckFactura.checked) return;
    if (!rucTouched)   ckRuc.value   = (ckCedula.value || '').trim();
    if (!razonTouched) ckRazon.value = `${(ckNombre.value || '').trim()} ${(ckApellido.value || '').trim()}`.trim();
  }

  ckRuc.addEventListener('input', () => rucTouched = true);
  ckRazon.addEventListener('input', () => razonTouched = true);
  [ckCedula, ckNombre, ckApellido].forEach(el => el.addEventListener('input', refreshFacturaDefaults));

  ckFactura.addEventListener('change', () => {
    facturaBox.classList.toggle('d-none', !ckFactura.checked);
    if (ckFactura.checked) refreshFacturaDefaults();
  });

  /* Interceptar botón "Generar Pedido" → abrir modal checkout */
  els.waBtn.addEventListener('click', ev => {
    if (getCart().length === 0) return;
    ev.preventDefault();
    resetForm();
    modalCheckout.show();
  });

  /* Submit checkout */
  f.addEventListener('submit', ev => {
    ev.preventDefault(); ev.stopPropagation();
    capErr?.classList.add('d-none');
    if (!f.checkValidity()) { f.classList.add('was-validated'); return; }

    const userCap = (aEl.value || '').trim().toUpperCase();
    if (!userCap || userCap !== captchaText.toUpperCase()) {
      capErr?.classList.remove('d-none');
      refreshCaptcha(); return;
    }

    const customer = {
      nombre:   ckNombre.value.trim(),
      apellido: ckApellido.value.trim(),
      telefono: ckTelefono.value.trim(),
      cedula:   ckCedula.value.trim(),
      correo:   ckCorreo.value.trim(),
    };

    const orderCode = buildOrderCode(customer.cedula);
    if (pedidoCodigoEl) pedidoCodigoEl.value = orderCode;
    if (pedidoOkMsg) {
      pedidoOkMsg.innerHTML = `
        <div class="fw-semibold">¡Pedido generado, muchas gracias!</div>
        <div class="text-secondary mt-1">Nos pondremos en contacto con usted.</div>
        <div class="mt-3">Guardá este código para consultar el estado de tu pedido:</div>`;
    }

    const msg = buildWAWithCustomer(orderCode, customer);
    lastLink  = `https://wa.me/${PHONE_WA}?text=${encodeURIComponent(msg)}`;

    modalCheckout.hide();
    modalOk.show();
  });

  btnAbrirWA?.addEventListener('click', () => {
    if (!lastLink) return;
    window.open(lastLink, '_blank', 'noopener,noreferrer');
    modalOk.hide();
  });

  modalCheckoutEl.addEventListener('shown.bs.modal', refreshCaptcha);
});

/* ── Init ── */
document.getElementById('yy').textContent = new Date().getFullYear();
render();

})(); // fin IIFE
