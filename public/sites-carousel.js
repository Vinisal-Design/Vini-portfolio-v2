// Carrossel da seção "Sites desenvolvidos": setas, contador e arrastar com o mouse (toque usa o scroll nativo).
(() => {
  const t = document.getElementById('sitesTrack');
  if (!t || !t.children.length) return;
  const cards = [...t.children], now = document.getElementById('sitesNow');
  const step = () => cards[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(t).columnGap) || 24);
  document.getElementById('sitesPrev').addEventListener('click', () => t.scrollBy({ left: -step(), behavior: 'smooth' }));
  document.getElementById('sitesNext').addEventListener('click', () => t.scrollBy({ left: step(), behavior: 'smooth' }));
  t.addEventListener('scroll', () => { now.textContent = String(Math.min(cards.length, Math.round(t.scrollLeft / step()) + 1)).padStart(2, '0'); }, { passive: true });
  let down = false, x0 = 0, s0 = 0, moved = false;
  t.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; x0 = e.clientX; s0 = t.scrollLeft; });
  window.addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 5) { moved = true; t.classList.add('dragging'); } t.scrollLeft = s0 - dx; });
  window.addEventListener('pointerup', () => { if (!down) return; down = false; t.classList.remove('dragging'); });
  t.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false; } }, true);
})();
