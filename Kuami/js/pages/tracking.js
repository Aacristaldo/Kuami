/* ============================================================
   js/pages/tracking.js — Seguimiento de compras (demo sin BD)
   ============================================================ */

const WA_PHONE      = '595984024413';
const ANTIROBOT_URL = 'api/antirobot.php';

const ORDER_STEPS = [
  { key: 'RECIBIDO',         label: 'Recibido',    hint: 'Pedido registrado' },
  { key: 'EN_PREPARACION',   label: 'Preparación', hint: 'Armando tu pedido' },
  { key: 'LISTO_PARA_ENVIO', label: 'Listo',       hint: 'Listo para envío'  },
  { key: 'EN_CAMINO',        label: 'En camino',   hint: 'En ruta'           },
  { key: 'ENTREGADO',        label: 'Entregado',   hint: 'Finalizado'        }
];

const MOCK_ORDERS = [
  { code:'KUA9F3X2Q1', cedula:'5123456', status:'EN_PREPARACION',   updatedAt:'2026-02-13 09:10', delivery:'Delivery (Luque)',     detail:'1 ramo + 10 fotos 7×9' },
  { code:'AB12CD34EF', cedula:'4678901', status:'EN_CAMINO',        updatedAt:'2026-02-13 08:40', delivery:'Retiro en tienda',     detail:'Caja regalo + tarjeta'  },
  { code:'ZX90QW12ER', cedula:'3987654', status:'ENTREGADO',        updatedAt:'2026-02-12 18:02', delivery:'Delivery (Asunción)',  detail:'Combo promo'            }
];

const $ = sel => document.querySelector(sel);

const els = {
  form:          $('#trkForm'),
  code:          $('#trkCode'),
  cedula:        $('#trkCedula'),
  msg:           $('#trkMsg'),
  resBox:        $('#trkResult'),
  resCode:       $('#resCode'),
  resCedula:     $('#resCedula'),
  resStatusText: $('#resStatusText'),
  resStatusPill: $('#resStatusPill'),
  resUpdatedAt:  $('#resUpdatedAt'),
  resDelivery:   $('#resDelivery'),
  resDetail:     $('#resDetail'),
  steps:         $('#trkSteps'),
  wa:            $('#trkWhatsapp'),
  clear:         $('#trkClear'),
  submit:        $('#trkSubmit'),
  capQ:          $('#trkCaptchaQ'),
  capA:          $('#trkCaptchaA'),
  capRefresh:    $('#trkCaptchaRefresh'),
  capHint:       $('#trkCaptchaHint')
};

let currentToken = '';
let waitTimer    = null;
let waitUntilTs  = 0;

const showMsg  = (t, type = 'ok') => { els.msg.className = `trk-msg ${type}`; els.msg.textContent = t; els.msg.style.display = 'block'; };
const hideMsg  = ()                => { els.msg.style.display = 'none'; els.msg.textContent = ''; els.msg.className = 'trk-msg'; };
const isBlocked = ()               => waitUntilTs > Date.now();

const normalizeCode   = v => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
const normalizeCedula = v => (v || '').replace(/\D/g, '');

function setLoading(on) {
  const dis = on || isBlocked();
  els.submit.disabled = dis; els.code.disabled = dis; els.cedula.disabled = dis;
  els.capA.disabled   = dis; if (els.capRefresh) els.capRefresh.disabled = dis;
  els.clear.disabled  = on;
  els.submit.innerHTML = on
    ? `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Buscando...`
    : `<i class="bi bi-search me-1"></i> Buscar pedido`;
}

function findOrder(code, cedula) {
  return MOCK_ORDERS.find(o => o.code === code && o.cedula === cedula) || null;
}

function statusIndex(key) {
  const i = ORDER_STEPS.findIndex(s => s.key === key);
  return i < 0 ? 0 : i;
}

function paintStatusPill(key) {
  const idx = statusIndex(key);
  const dot = els.resStatusPill.querySelector('.dot');
  const apply = (bc, bg, dc, ds) => {
    els.resStatusPill.style.borderColor = bc; els.resStatusPill.style.background = bg;
    if (dot) { dot.style.background = dc; dot.style.boxShadow = ds; }
  };
  if (idx >= 4) apply('rgba(34,197,94,.35)','rgba(34,197,94,.12)','rgba(34,197,94,.95)','0 0 0 4px rgba(34,197,94,.18)');
  else if (idx >= 2) apply('rgba(59,130,246,.35)','rgba(59,130,246,.12)','rgba(59,130,246,.95)','0 0 0 4px rgba(59,130,246,.18)');
  else apply('rgba(245,158,11,.35)','rgba(245,158,11,.12)','rgba(245,158,11,.95)','0 0 0 4px rgba(245,158,11,.18)');
}

function renderSteps(activeStatus) {
  const idx = statusIndex(activeStatus);
  els.steps.innerHTML = '';
  ORDER_STEPS.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'trk-step' + (i < idx ? ' done' : '') + (i === idx ? ' active' : '');
    d.innerHTML = `<strong>${s.label}</strong><small>${s.hint}</small>`;
    els.steps.appendChild(d);
  });
}

function buildWhatsappLink(order) {
  const msg = `Hola, quiero consultar el estado de mi pedido.\nCódigo: ${order.code}\nCédula: ${order.cedula}\nEstado: ${order.status}`;
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(msg)}`;
}

function startWait(seconds) {
  clearInterval(waitTimer);
  waitUntilTs = Date.now() + seconds * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((waitUntilTs - Date.now()) / 1000));
    if (els.capHint) els.capHint.textContent = left > 0 ? `Demasiados intentos. Esperá ${left}s para volver a intentar.` : '';
    if (left <= 0) { clearInterval(waitTimer); waitUntilTs = 0; if (els.capHint) els.capHint.textContent = ''; setLoading(false); refreshChallenge(); }
    else { els.submit.disabled = els.code.disabled = els.cedula.disabled = els.capA.disabled = true; if (els.capRefresh) els.capRefresh.disabled = true; }
  };
  tick(); waitTimer = setInterval(tick, 1000);
}

async function refreshChallenge() {
  if (!els.capQ) return;
  els.capQ.textContent = 'Cargando...'; currentToken = '';
  if (els.capA) els.capA.value = '';
  try {
    const r = await fetch(`${ANTIROBOT_URL}?action=new`, { cache: 'no-store' });
    const j = await r.json();
    if (j.blocked && j.wait_seconds) { startWait(j.wait_seconds); return; }
    if (!j.ok) { els.capQ.textContent = 'Error al cargar antirobot'; if (els.capHint) els.capHint.textContent = 'Probá recargar la página.'; return; }
    currentToken = j.token; els.capQ.textContent = j.question; if (els.capHint) els.capHint.textContent = '';
  } catch {
    els.capQ.textContent = 'Error al cargar antirobot'; if (els.capHint) els.capHint.textContent = 'Revisá tu ruta api/antirobot.php';
  }
}

async function verifyChallenge(answer) {
  const fd = new FormData();
  fd.append('action','verify'); fd.append('token', currentToken); fd.append('answer', answer);
  const r = await fetch(`${ANTIROBOT_URL}?action=verify`, { method:'POST', body:fd, cache:'no-store' });
  return r.json();
}

els.code.addEventListener('input', e => e.target.value = normalizeCode(e.target.value));
els.cedula.addEventListener('input', e => e.target.value = normalizeCedula(e.target.value));
els.capA.addEventListener('input', e => e.target.value = (e.target.value || '').trim());
els.capRefresh?.addEventListener('click', () => { hideMsg(); if (!isBlocked()) refreshChallenge(); });
els.clear.addEventListener('click', () => { els.form.reset(); els.code.value = ''; els.cedula.value = ''; if (els.capA) els.capA.value = ''; els.resBox.style.display = 'none'; hideMsg(); if (!isBlocked()) refreshChallenge(); });

els.form.addEventListener('submit', async e => {
  e.preventDefault();
  if (isBlocked()) return;
  hideMsg(); els.resBox.style.display = 'none';

  const code   = normalizeCode(els.code.value);
  const cedula = normalizeCedula(els.cedula.value);
  const cap    = (els.capA.value || '').trim();

  if (code.length !== 10)        { showMsg('El código debe tener exactamente 10 caracteres.', 'err'); els.code.focus(); return; }
  if (!cedula || cedula.length < 5) { showMsg('Ingresá una cédula válida (solo números).', 'err'); els.cedula.focus(); return; }
  if (!currentToken)             { showMsg('Antirobot no cargó. Probá actualizar.', 'err'); await refreshChallenge(); return; }
  if (!cap)                      { showMsg('Ingresá la respuesta del antirobot.', 'err'); els.capA.focus(); return; }

  setLoading(true);
  let anti;
  try { anti = await verifyChallenge(cap); }
  catch { setLoading(false); showMsg('Error al validar antirobot. Revisá tu API.', 'err'); return; }

  if (!anti.ok) {
    setLoading(false);
    if (anti.blocked && anti.wait_seconds) { showMsg('Bloqueado por intentos fallidos.', 'err'); startWait(anti.wait_seconds); return; }
    if (anti.wait_seconds) { showMsg('Antirobot incorrecto. Se aplicó penalización.', 'err'); startWait(anti.wait_seconds); return; }
    showMsg('Antirobot incorrecto. Probá de nuevo.', 'err');
    await refreshChallenge(); return;
  }

  await new Promise(r => setTimeout(r, 250));
  const order = findOrder(code, cedula);
  setLoading(false);

  if (!order) { showMsg('No se encontró un pedido con ese código y cédula.', 'err'); await refreshChallenge(); return; }

  els.resCode.textContent       = order.code;
  els.resCedula.textContent     = order.cedula;
  els.resStatusText.textContent = order.status.replaceAll('_', ' ');
  els.resUpdatedAt.textContent  = order.updatedAt || '—';
  els.resDelivery.textContent   = order.delivery  || '—';
  els.resDetail.textContent     = order.detail    || '—';

  paintStatusPill(order.status);
  renderSteps(order.status);
  els.wa.href = buildWhatsappLink(order);
  els.resBox.style.display = 'block';
  showMsg('Pedido encontrado.', 'ok');
  await refreshChallenge();
});

document.addEventListener('DOMContentLoaded', () => refreshChallenge());
