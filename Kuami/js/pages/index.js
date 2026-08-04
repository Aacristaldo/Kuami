/* ============================================================
   js/pages/index.js
   Usa js/utils.js (window.KuamiUtils) como ÚNICA fuente de verdad
   del carrito y las notificaciones de stock — es el mismo carrito
   que después lee carrito.js en carrito.html. Por eso index.html
   debe cargar js/utils.js ANTES de este archivo.

   Todo va adentro de una IIFE para que sus variables (formatGs,
   addToCart, etc.) no choquen con las funciones globales que ya
   define utils.js. Sin esto, el navegador tira "Identifier ya
   declarado" y el archivo entero deja de ejecutarse.
   ============================================================ */
(function () {

const {
  formatGs, addToCart, updateCartBadge,
  saveNotifyRequest, getNotifyForProduct,
  setFooterYear
} = window.KuamiUtils;

/* ── Productos extra ── */
/* Para cambiar stock: inStock: true / false */
const EXTRA_PRODUCTS = [
  { id:'pe01', t:'Foto 5x7',           cat:'tejidos',              p:3000,   unit:3000,  combo:25000, isPhotoCalc:true,  inStock:true,  img:'assets/productos/img13.jpg' },
  { id:'pe02', t:'Fotos 7x9',          cat:'tejidos',              p:5000,   unit:5000,  combo:50000, isPhotoCalc:true,  inStock:true,  img:'assets/productos/img15.jpg' },
  { id:'pe03', t:'Mini bouquet',        cat:'ramos',                p:75000,                           inStock:true,  img:'assets/productos/img04.jpg' },
  { id:'pe04', t:'Ramo clasico',        cat:'ramos',                p:110000,                          inStock:true,  img:'assets/productos/img03.jpg' },
  { id:'pe05', t:'Set foto y corazon',  cat:'tejidos',              p:85000,                           inStock:false, img:'assets/productos/img05.jpg' },
  { id:'pe06', t:'Ramo premium',        cat:'ramos personalizados', p:190000,                          inStock:true,  img:'assets/productos/img06.jpg' },
  { id:'pe07', t:'Fotos con Colgantes', cat:'tejidos',              p:45000,                           inStock:true,  img:'assets/productos/img07.jpg' },
  { id:'pe08', t:'Caja Corazones',      cat:'personalizados',       p:150000,                          inStock:false, img:'assets/productos/img08.jpg' },
  { id:'pe09', t:'Cuadros',             cat:'personalizados',       p:130000,                          inStock:true,  img:'assets/productos/img09.jpg' },
  { id:'pe10', t:'Cajitas sorpresas',   cat:'personalizados',       p:140000,                          inStock:true,  img:'assets/productos/img10.jpg' },
  { id:'pe11', t:'Calendarios',         cat:'personalizados',       p:80000,                           inStock:false, img:'assets/productos/img11.jpg' },
  { id:'pe12', t:'Cajas y flores',      cat:'tejidos',              p:95000,                           inStock:true,  img:'assets/productos/img12.jpg' },
];

/* ── Render tarjeta ──
   Lógica única para TODO producto del sitio (grilla dinámica y estática,
   y tarjetas flip del catálogo):
     1) Sin stock              -> "Avisame"                (mantiene el aviso)
     2) Precio por combo/tanda -> "Calcular"                (abre la calculadora)
     3) Sin precio fijo        -> "Consultar por WhatsApp"   (no aplica acá)
     4) Cualquier otro caso    -> cantidad + "Agregar al carrito"
   El botón "Ver" deja de competir con Agregar: pasa a ser una lupa
   sobre la imagen (misma idea que en las tarjetas flip del catálogo).
   ── */
function qtyStepperHtml() {
  return `<div class="qty-stepper">
      <button type="button" class="qty-btn qty-minus" aria-label="Restar">&minus;</button>
      <input type="number" class="qty-input" value="1" min="1" inputmode="numeric" aria-label="Cantidad">
      <button type="button" class="qty-btn qty-plus" aria-label="Sumar">+</button>
    </div>`;
}

function buildProductCard(e) {
  const outOfStock = !e.inStock;

  let actionHtml;
  if (outOfStock) {
    actionHtml = `<button class="btn btn-sm btn-notify btn-avisame w-100"
        data-id="${e.id}" data-name="${e.t}" data-img="${e.img}">
        <i class="bi bi-bell me-1"></i>Avisame
      </button>`;
  } else if (e.isPhotoCalc) {
    actionHtml = `<button class="btn btn-sm btn-outline-primary btn-foto-calc w-100"
        data-bs-toggle="modal" data-bs-target="#modalFotoCalc"
        data-id="${e.id}" data-name="${e.t}"
        data-unit="${e.unit || e.p}" data-combo="${e.combo || 0}"
        data-img="${e.img}"><i class="bi bi-calculator me-1"></i>Calcular</button>`;
  } else {
    actionHtml = `<div class="product-add-row">
        ${qtyStepperHtml()}
        <button class="btn btn-sm btn-pri btn-add"
          data-id="${e.id}" data-name="${e.t}"
          data-price="${e.p}" data-img="${e.img}"><i class="bi bi-bag-plus me-1"></i>Agregar al carrito</button>
      </div>`;
  }

  const stockBadge = outOfStock ? `<span class="badge-stock-out">Agotado</span>` : '';

  return `
    <div class="col-6 col-md-4 col-lg-3 product" data-cat="${e.cat}">
      <div class="card product-card rounded-4${outOfStock ? ' out-of-stock' : ''}">
        ${stockBadge}
        <img src="${e.img}" alt="${e.t}" loading="lazy" class="w-100">
        <button type="button" class="pc-zoom" data-bs-toggle="modal" data-bs-target="#modalImg"
          data-img="${e.img}" data-title="${e.t}" aria-label="Ver ${e.t}"><i class="bi bi-zoom-in"></i></button>
        <div class="card-body">
          <h6 class="mb-1">${e.t}</h6>
          <div class="small text-secondary text-truncate">${e.cat}</div>
          <div class="d-flex justify-content-between align-items-center mt-2">
            <span class="price">${formatGs(e.p)}</span>
          </div>
          ${outOfStock || e.isPhotoCalc ? `<div class="mt-2">${actionHtml}</div>` : actionHtml}
        </div>
      </div>
    </div>`;
}

/* ── Inyectar grid ── */
function renderExtraProducts() {
  const grid = document.getElementById('gridProductos');
  if (!grid) { console.warn('gridProductos no encontrado'); return; }
  grid.insertAdjacentHTML('beforeend', EXTRA_PRODUCTS.map(buildProductCard).join(''));
  console.log('EXTRA_PRODUCTS inyectados:', EXTRA_PRODUCTS.length);
}

/* ── Filtros ── */
function initFilters() {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cat = btn.dataset.filter;
      document.querySelectorAll('#gridProductos .product').forEach(card => {
        const has = (card.dataset.cat || '').toLowerCase().includes(cat);
        card.classList.toggle('d-none', cat !== 'all' && !has);
      });
    });
  });
}

/* ── Modal imagen ── */
function initModalImg() {
  const modal = document.getElementById('modalImg');
  if (!modal) return;
  modal.addEventListener('show.bs.modal', e => {
    const b = e.relatedTarget; if (!b) return;
    modal.querySelector('.modal-title').textContent = b.getAttribute('data-title') || '';
    const img = modal.querySelector('img');
    img.src = b.getAttribute('data-img') || '';
    img.alt = b.getAttribute('data-title') || '';
  });
}

/* ── Agregar al carrito (delegado) ──
   Toma la cantidad del qty-stepper más cercano (si existe). Cubre tanto
   los botones ".btn-add" del grid como los ".kc-add" de las tarjetas flip. */
function initAddToCart() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-add, .kc-add:not(.is-consulta)');
    if (!btn) return;
    const row     = btn.closest('.product-add-row, .kc-add-row') || btn.parentElement;
    const qtyEl   = row ? row.querySelector('.qty-input') : null;
    const qty     = Math.max(1, parseInt(qtyEl?.value, 10) || 1);
    addToCart({
      id:    btn.dataset.id,
      name:  btn.dataset.name,
      price: parseInt(btn.dataset.price, 10) || 0,
      img:   btn.dataset.img,
      qty
    });
    if (qtyEl) qtyEl.value = 1; // se resetea para el próximo agregado
  });
}

/* ── Selector de cantidad (+ / −), delegado para toda la página ── */
function initQtyStepper() {
  document.addEventListener('click', e => {
    const btn = e.target.closest('.qty-btn');
    if (!btn) return;
    const wrap  = btn.closest('.qty-stepper');
    const input = wrap?.querySelector('.qty-input');
    if (!input) return;
    const current = Math.max(1, parseInt(input.value, 10) || 1);
    input.value = btn.classList.contains('qty-plus') ? current + 1 : Math.max(1, current - 1);
  });
  document.addEventListener('change', e => {
    if (!e.target.classList.contains('qty-input')) return;
    e.target.value = Math.max(1, parseInt(e.target.value, 10) || 1);
  });
}

/* ── Modal calculadora de fotos ── */
function initFotoCalc() {
  const modal = document.getElementById('modalFotoCalc');
  if (!modal) return;

  const state  = { id:'', name:'', unit:0, combo:0, img:'', qty:1, mode:'unit', _c:null };
  const elQty  = document.getElementById('fotoCalcQty');
  const elDet  = document.getElementById('fotoCalcDetalle');
  const elTot  = document.getElementById('fotoCalcTotal');
  const pBox   = document.getElementById('promoBox');
  const rYes   = document.getElementById('promoYes');
  const rNo    = document.getElementById('promoNo');

  function calc() {
    const qty  = Math.max(1, parseInt(state.qty, 10) || 1);
    const unit = Math.max(0, state.unit);
    const promo = qty >= 25;
    pBox.classList.toggle('d-none', !promo);
    if (!promo) { state.mode = 'unit'; if (rNo) rNo.checked = true; if (rYes) rYes.checked = false; }

    let combos = 0, resto = qty;
    if (state.mode === 'promo') { combos = Math.floor(qty / 25); resto = qty % 25; }
    const cp    = state.combo > 0 ? state.combo : unit * 25;
    const total = combos * cp + resto * unit;

    elDet.textContent = state.mode === 'promo'
      ? `${combos} combo(s) de 25 + ${resto} unitarias`
      : `${qty} unitarias`;
    elTot.textContent = formatGs(total);
    state._c = { qty, unit, cp, combos, resto, total, mode: state.mode };
  }

  modal.addEventListener('show.bs.modal', e => {
    const b = e.relatedTarget; if (!b) return;
    state.id    = b.getAttribute('data-id') || '';
    state.name  = b.getAttribute('data-name') || 'Fotos';
    state.unit  = parseInt(b.getAttribute('data-unit') || '0', 10) || 0;
    state.combo = parseInt(b.getAttribute('data-combo') || '0', 10) || 0;
    state.img   = b.getAttribute('data-img') || '';
    state.qty = 1; state.mode = 'unit';
    document.getElementById('fotoCalcTitle').textContent = state.name;
    const meta = document.getElementById('fotoCalcMeta');
    if (meta) meta.textContent = `${formatGs(state.unit)} c/u${state.combo > 0 ? ' • Combo 25: ' + formatGs(state.combo) : ''}`;
    const img = document.getElementById('fotoCalcImg');
    if (img) { img.src = state.img; img.alt = state.name; }
    if (elQty) elQty.value = 1;
    if (rNo) rNo.checked = true; if (rYes) rYes.checked = false;
    calc();
  });

  if (elQty) {
    elQty.addEventListener('input',  ev => { state.qty = ev.target.value; calc(); });
    elQty.addEventListener('change', ev => { state.qty = ev.target.value; calc(); });
  }
  if (rYes) rYes.addEventListener('change', () => { state.mode = 'promo'; calc(); });
  if (rNo)  rNo.addEventListener('change',  () => { state.mode = 'unit';  calc(); });

  document.getElementById('fotoCalcAdd')?.addEventListener('click', () => {
    const c = state._c || { qty:1, unit:state.unit, cp:state.combo||(state.unit*25), combos:0, resto:1, total:state.unit, mode:'unit' };
    addToCart({
      id: state.id, name: state.name, img: state.img,
      qty: c.qty, price: c.unit, mode: c.mode, comboPrice: c.cp,
      detail: c.mode === 'promo' ? `${c.combos} combo(s) de 25 + ${c.resto} unitarias` : `${c.qty} unitarias`
    });
    bootstrap.Modal.getInstance(modal)?.hide();
  });
}

/* ── Modal Avisame ── */
function initNotifyModal() {
  const modal = document.getElementById('modalAvisame');
  if (!modal) return;

  const titleEl   = document.getElementById('avisameTitle');
  const chanWA    = document.getElementById('chanWA');
  const chanEmail = document.getElementById('chanEmail');
  const inputWrap = document.getElementById('notifyInputWrap');
  const inputEl   = document.getElementById('notifyInput');
  const labelEl   = document.getElementById('notifyInputLabel');
  const btnSave   = document.getElementById('btnGuardarAviso');
  const okMsg     = document.getElementById('avisameSuccess');

  let pid = '', pname = '';

  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-avisame');
    if (!btn) return;
    pid   = btn.dataset.id;
    pname = btn.dataset.name;
    if (titleEl) titleEl.textContent = pname;
    if (okMsg)   okMsg.className = 'd-none';
    if (inputWrap) { inputWrap.classList.remove('visible'); inputWrap.classList.add('hidden'); }
    if (chanWA)    chanWA.checked = false;
    if (chanEmail) chanEmail.checked = false;

    const ex = getNotifyForProduct(pid);
    if (ex && okMsg) {
      okMsg.textContent = `Ya registraste un aviso (${ex.channel === 'wa' ? 'WhatsApp' : 'Email'}: ${ex.contact})`;
      okMsg.className = 'alert alert-info mt-2';
    }
    bootstrap.Modal.getOrCreateInstance(modal).show();
  });

  function updateChan() {
    const isWA = chanWA?.checked, isEmail = chanEmail?.checked;
    if (!isWA && !isEmail) { inputWrap?.classList.add('hidden'); return; }
    inputWrap?.classList.remove('hidden'); inputWrap?.classList.add('visible');
    if (labelEl) labelEl.textContent = isWA ? 'Tu número de WhatsApp' : 'Tu correo electrónico';
    if (inputEl) { inputEl.type = isWA ? 'tel' : 'email'; inputEl.placeholder = isWA ? 'Ej: 0984123456' : 'tucorreo@ejemplo.com'; inputEl.value = ''; }
  }

  chanWA?.addEventListener('change', updateChan);
  chanEmail?.addEventListener('change', updateChan);

  btnSave?.addEventListener('click', () => {
    const isWA    = chanWA?.checked;
    const isEmail = chanEmail?.checked;
    const contact = (inputEl?.value || '').trim();
    const errEl   = modal.querySelector('.notify-val-err');
    if (errEl) errEl.remove();

    if (!isWA && !isEmail) { addErr('Elegí un canal (WhatsApp o Email).'); return; }
    if (!contact) { addErr(isWA ? 'Ingresá tu número de WhatsApp.' : 'Ingresá tu correo.'); return; }
    if (isEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) { addErr('El correo no es válido.'); return; }

    saveNotifyRequest(pid, pname, isWA ? 'wa' : 'email', contact);
    if (inputWrap) inputWrap.classList.add('hidden');
    if (okMsg) {
      okMsg.textContent = `Listo! Te avisamos por ${isWA ? 'WhatsApp ' + contact : contact} cuando haya stock.`;
      okMsg.className = 'alert alert-success mt-3';
    }
    document.querySelectorAll(`.btn-avisame[data-id="${pid}"]`).forEach(b => {
      b.innerHTML = '<i class="bi bi-bell-fill me-1"></i>Aviso guardado';
      b.disabled = true; b.style.opacity = '.7';
    });
    setTimeout(() => bootstrap.Modal.getInstance(modal)?.hide(), 1600);
  });

  function addErr(msg) {
    const el = document.createElement('div');
    el.className = 'alert alert-danger mt-2 notify-val-err';
    el.textContent = msg;
    inputWrap?.after(el);
    setTimeout(() => el.remove(), 2800);
  }
}

/* ── Countdown ── */
function initCountdown() {
  const out = document.getElementById('countdown');
  if (!out) return;
  const end = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 7, 23, 59, 59);
  setInterval(() => {
    const s = Math.max(0, Math.floor((end - new Date()) / 1000));
    const p = n => String(n).padStart(2, '0');
    out.textContent = `${p(Math.floor(s/86400))}d:${p(Math.floor(s%86400/3600))}h:${p(Math.floor(s%3600/60))}m:${p(s%60)}s`;
  }, 1000);
}

/* ── Formulario contacto ── */
function initContactForm() {
  const form = document.querySelector('.needs-validation');
  if (!form) return;
  form.addEventListener('submit', ev => {
    if (!form.checkValidity()) { ev.preventDefault(); ev.stopPropagation(); }
    form.classList.add('was-validated');
  });
}

/* ── Navbar scroll ── */
function initNavbar() {
  const nav = document.querySelector('.navbar');
  if (!nav) return;
  const fn = () => nav.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', fn, { passive: true });
  fn();
}

/* ── Giro 3D de las tarjetas del catálogo ── */
function initFlipCards() {
  document.querySelectorAll('.kc-flip').forEach(flip => {
    const card = flip.closest('.kc-card');
    if (!card) return;

    // Clic sobre la tarjeta la gira (salvo si tocaste agregar, cantidad o la lupa)
    const isInteractive = t => t.closest('.kc-add, .qty-stepper, .kc-zoom');

    flip.addEventListener('click', e => {
      if (isInteractive(e.target)) return;
      card.classList.toggle('is-flipped');
    });

    // Accesibilidad: Enter / Espacio también giran
    flip.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (isInteractive(e.target)) return;
      e.preventDefault();
      card.classList.toggle('is-flipped');
    });
  });
}

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  console.log('index.js DOMContentLoaded OK');
  renderExtraProducts();
  initFlipCards();
  initFilters();
  initModalImg();
  initAddToCart();
  initQtyStepper();
  initFotoCalc();
  initNotifyModal();
  initCountdown();
  initContactForm();
  initNavbar();
  setFooterYear();
  updateCartBadge();
});

})(); // fin IIFE
