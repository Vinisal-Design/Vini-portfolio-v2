// Seção "Sites desenvolvidos" (#awards) da home <-> view `home_sites`.
// Carrossel de "janelas" com o print da home de cada site; CSS/JS em public/sites-carousel.* (só a home carrega).
import { encode } from './cards.mjs';

const OPEN = '<section class="section section-awards" id="awards"';
export function splitSection(html) {
  const a = html.indexOf(OPEN);
  const b = html.indexOf('</section>', a);
  if (a < 0 || b < 0) throw new Error('seção #awards não encontrada no index.html');
  return { before: html.slice(0, a), section: html.slice(a, b + '</section>'.length), after: html.slice(b + '</section>'.length) };
}

const pad = n => String(n).padStart(2, '0');
const domain = u => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u; } };
const ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 17L17 7M17 7H7M17 7V17"/></svg>';

export function renderSection(sites) {
  const cards = sites.map(s => {
    const img = s.shot
      ? `<img src="${encode(s.shot)}-720.webp" srcset="${encode(s.shot)}-480.webp 480w, ${encode(s.shot)}-720.webp 720w, ${encode(s.shot)}-960.webp 960w" sizes="(max-width: 600px) 72vw, (max-width: 1024px) 40vw, 420px" width="720" height="450" alt="${encode(s.name)} &#8212; p&#225;gina inicial" loading="lazy" decoding="async" draggable="false">`
      : '<div class="site-noshot"></div>';
    return `
    <a href="${encode(s.url)}" target="_blank" rel="noopener noreferrer" class="site-card" draggable="false">
      <div class="site-window">
        <div class="site-bar"><i></i><i></i><i></i><span>${encode(domain(s.url))}</span></div>
        ${img}
      </div>
      <div class="site-meta">
        <div><div class="site-name">${encode(s.name)}</div><div class="site-type">${encode(s.label || '')}</div></div>
        <span class="site-go">${ARROW}</span>
      </div>
    </a>`;
  }).join('');
  return `${OPEN} data-section-theme="dark">
  <div class="container">
    <div class="section-eyebrow">
      <span class="eyebrow-dot"></span>
      <span class="eyebrow-text" data-reveal>UX &amp; UI</span>
    </div>
    <div class="sites-head">
      <h2 class="section-title" data-split-chars>Sites desenvolvidos</h2>
      <div class="sites-nav" data-reveal>
        <span class="sites-count"><b id="sitesNow">01</b> / ${pad(sites.length)}</span>
        <button class="sites-btn" id="sitesPrev" aria-label="Anterior"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 12H5M5 12l7-7M5 12l7 7"/></svg></button>
        <button class="sites-btn" id="sitesNext" aria-label="Pr&#243;ximo"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
      </div>
    </div>
  </div>
  <div class="sites-track" id="sitesTrack" data-cursor="drag">${cards}
  </div>
</section>`;
}
