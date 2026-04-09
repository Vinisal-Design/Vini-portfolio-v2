/* Shared cursor module for subpages */
export function initCursor() {
  // On touch devices, keep native cursor
  if (window.matchMedia('(hover: none)').matches) return;

  const cursor = document.getElementById('cursor');
  const cursorLabel = document.getElementById('cursorLabel');
  if (!cursor || !cursorLabel) return;

  let cursorX = -100, cursorY = -100;
  let targetCursorX = -100, targetCursorY = -100;
  let hasMoved = false;

  // Hide custom cursor until first mouse move
  cursor.style.opacity = '0';

  document.addEventListener('mousemove', (e) => {
    targetCursorX = e.clientX;
    targetCursorY = e.clientY;
    if (!hasMoved) {
      hasMoved = true;
      cursorX = targetCursorX;
      cursorY = targetCursorY;
      cursor.style.opacity = '1';
      // Now hide native cursor since custom is active
      document.body.style.cursor = 'none';
      document.querySelectorAll('a, button').forEach(el => {
        el.style.cursor = 'none';
      });
    }
  });

  document.querySelectorAll('[data-cursor]').forEach(el => {
    const label = el.dataset.cursor;
    el.addEventListener('mouseenter', () => {
      cursor.className = 'cursor ' + label;
      cursorLabel.textContent = label === 'view' ? 'View' : label === 'explore' ? 'Explore' : label === 'drag' ? 'Drag' : '';
    });
    el.addEventListener('mouseleave', () => {
      cursor.className = 'cursor';
      cursorLabel.textContent = '';
    });
  });

  document.querySelectorAll('a:not([data-cursor]), button:not([data-cursor])').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hover'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hover'); });
  });

  function animateCursor() {
    const ease = 0.15;
    cursorX += (targetCursorX - cursorX) * ease;
    cursorY += (targetCursorY - cursorY) * ease;
    cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
    requestAnimationFrame(animateCursor);
  }
  animateCursor();
}
