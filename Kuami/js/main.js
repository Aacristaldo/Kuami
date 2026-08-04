/* ============================================================
   js/main.js — Init global (se carga en todas las páginas)
   - Navbar shrink al scroll
   - Año footer
   - Badge carrito
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  const { updateCartBadge, setFooterYear } = window.KuamiUtils;

  /* ── Navbar shrink ── */
  const nav = document.querySelector('.navbar');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Año ── */
  setFooterYear();

  /* ── Badge ── */
  updateCartBadge();
});
