/* ═══════════════════════════════════════════════════
   PORTFOLIO V2 — Animation Engine
   Fusion: All 22 patterns + 8 DNA sources
   Signature easing: cubic-bezier(0, 0, .25, 1)
   ═══════════════════════════════════════════════════ */

import './style.css';

// ── PRELOADER ──
const preloader = document.getElementById('preloader');
const preloaderBar = document.getElementById('preloaderBar');
let preloaderProgress = 0;

function updatePreloader() {
  preloaderProgress += Math.random() * 15 + 5;
  if (preloaderProgress > 100) preloaderProgress = 100;
  preloaderBar.style.width = preloaderProgress + '%';
  if (preloaderProgress < 100) {
    requestAnimationFrame(() => setTimeout(updatePreloader, 60));
  }
}
updatePreloader();

window.addEventListener('load', () => {
  preloaderBar.style.width = '100%';
  setTimeout(() => {
    preloader.classList.add('done');
    initAnimations();
  }, 600);
});


// ── SCROLL PROGRESS ──
const scrollProgress = document.getElementById('scrollProgress');

function updateScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
  scrollProgress.style.height = pct + '%';
  requestAnimationFrame(updateScrollProgress);
}
requestAnimationFrame(updateScrollProgress);


// ── CUSTOM CURSOR ──
const cursor = document.getElementById('cursor');
const cursorLabel = document.getElementById('cursorLabel');
let cursorX = -100, cursorY = -100;
let targetX = -100, targetY = -100;
let cursorVisible = false;

function initCursor() {
  if (window.matchMedia('(hover: none)').matches) {
    document.body.style.cursor = 'auto';
    document.querySelectorAll('a, button').forEach(el => { el.style.cursor = 'pointer'; });
    if (cursor) cursor.style.display = 'none';
    return;
  }

  if (!cursor || !cursorLabel) return;

  document.body.classList.add('has-custom-cursor');

  cursor.style.opacity = '0';

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!cursorVisible) {
      cursorVisible = true;
      cursorX = targetX;
      cursorY = targetY;
      cursor.style.opacity = '1';
    }
  });

  document.querySelectorAll('[data-cursor]').forEach(el => {
    const type = el.dataset.cursor;
    el.addEventListener('mouseenter', () => {
      cursor.className = 'cursor ' + type;
      cursorLabel.textContent = type === 'view' ? 'View' : type === 'explore' ? 'Explore' : type === 'drag' ? 'Drag' : '';
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

  function moveCursor() {
    cursorX += (targetX - cursorX) * 0.15;
    cursorY += (targetY - cursorY) * 0.15;
    cursor.style.transform = `translate(${cursorX}px, ${cursorY}px)`;
    requestAnimationFrame(moveCursor);
  }
  moveCursor();
}


// ── MENU OVERLAY ──
const navBurger = document.getElementById('navBurger');
const menuOverlay = document.getElementById('menuOverlay');

function initMenu() {
  navBurger.addEventListener('click', () => {
    const isOpen = menuOverlay.classList.contains('open');
    navBurger.classList.toggle('active');
    menuOverlay.classList.toggle('open');
    document.body.style.overflow = isOpen ? '' : 'hidden';
  });

  menuOverlay.querySelectorAll('.menu-link').forEach(link => {
    link.addEventListener('click', () => {
      navBurger.classList.remove('active');
      menuOverlay.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOverlay.classList.contains('open')) {
      navBurger.classList.remove('active');
      menuOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}


// ── SCROLL REVEAL ──
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}


// ── SPLIT TEXT ANIMATION ──
function initSplitText() {
  const elements = document.querySelectorAll('[data-split-chars]');

  elements.forEach(el => {
    const text = el.textContent.trim();
    el.innerHTML = '';
    el.setAttribute('aria-label', text);

    const words = text.split(/\s+/);
    let charIndex = 0;

    words.forEach((word, wordIdx) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      wordSpan.setAttribute('aria-hidden', 'true');

      for (const char of word) {
        const charSpan = document.createElement('span');
        charSpan.className = 'char';
        charSpan.style.setProperty('--char-i', charIndex);
        charSpan.textContent = char;
        charSpan.setAttribute('aria-hidden', 'true');
        wordSpan.appendChild(charSpan);
        charIndex++;
      }

      el.appendChild(wordSpan);

      if (wordIdx < words.length - 1) {
        const space = document.createElement('span');
        space.className = 'char';
        space.style.setProperty('--char-i', charIndex);
        space.textContent = ' ';
        space.setAttribute('aria-hidden', 'true');
        el.appendChild(space);
        charIndex++;
      }
    });
  });

  const textObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.querySelectorAll('.char').forEach((char, i) => {
          setTimeout(() => { char.classList.add('revealed'); }, i * 30);
        });
        textObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  elements.forEach(el => textObserver.observe(el));
}


// ── MORPHING PILL ──
function initPillMorph() {
  const words = document.querySelectorAll('.hero-pill-word');
  if (words.length === 0) return;

  let current = 0;
  setInterval(() => {
    words[current].classList.remove('active');
    current = (current + 1) % words.length;
    words[current].classList.add('active');
  }, 2000);
}


// ── 3D TILT HOVER ──
function initTilt() {
  if (window.matchMedia('(hover: none)').matches) return;

  document.querySelectorAll('[data-tilt]').forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      el.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    el.addEventListener('mouseleave', () => {
      el.style.transform = 'perspective(800px) rotateX(0) rotateY(0)';
      el.style.transition = 'transform 0.5s cubic-bezier(.19,1,.22,1)';
      setTimeout(() => { el.style.transition = ''; }, 500);
    });
  });
}


// ── PARALLAX SCROLL ──
function initParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const elements = document.querySelectorAll('[data-parallax]');

  function updateParallax() {
    elements.forEach(el => {
      const speed = parseFloat(el.dataset.parallax) || 0.1;
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2;
      const windowCenter = window.innerHeight / 2;
      const offset = (centerY - windowCenter) * speed;

      el.style.transform = `translateY(${offset}px)`;
    });
    requestAnimationFrame(updateParallax);
  }
  updateParallax();
}


// ── COUNTER ANIMATION ──
function initCounters() {
  const counters = document.querySelectorAll('[data-count]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.count);
        let current = 0;
        const duration = 1500;
        const start = performance.now();

        function animate(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          current = Math.round(eased * target);
          el.textContent = current;
          if (progress < 1) requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(el => observer.observe(el));
}


// ── AWARD HOVER IMAGE ──
function initAwardHover() {
  if (window.matchMedia('(hover: none)').matches) return;

  document.querySelectorAll('.award-item').forEach(item => {
    const img = item.querySelector('.award-hover-img');
    if (!img) return;

    item.addEventListener('mousemove', (e) => {
      const rect = item.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      img.style.left = x + 'px';
      img.style.top = y + 'px';
      img.style.transform = `translate(-50%, -50%) rotate(${(x - rect.width / 2) * 0.02}deg)`;
    });
  });
}


// ── SMOOTH ANCHOR SCROLLING ──
function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    const href = link.getAttribute('href');
    if (href === '#') return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}


// ── PORTFOLIO FILTERS ──
function initFilters() {
  const filters = document.querySelectorAll('.work-filter');
  const cases = document.querySelectorAll('.work-case');

  if (!filters.length) return;

  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');

      cases.forEach(c => {
        if (filter === 'all' || c.dataset.category === filter) {
          c.classList.remove('hidden');
        } else {
          c.classList.add('hidden');
        }
      });
    });
  });
}


// ── INIT ALL ──
function initAnimations() {
  initCursor();
  initMenu();
  initReveal();
  initSplitText();
  initPillMorph();
  initTilt();
  initParallax();
  initCounters();
  initAwardHover();
  initSmoothAnchors();
  initFilters();
  requestAnimationFrame(updateScrollProgress);
}

// Fallback if load event already fired
if (document.readyState === 'complete') {
  preloader.classList.add('done');
  initAnimations();
}
