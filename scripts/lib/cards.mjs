// Card da home (.work-case) <-> linha de `projects`.
// O markup reproduz o index.html original caractere a caractere: todo não-ASCII vira entidade decimal.

export const encode = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[^\x00-\x7f]/gu, c => `&#${c.codePointAt(0)};`);

export const decode = s => String(s ?? '')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const GRID_OPEN = '<div class="work-grid">';
const GRID_CLOSE = '\n    </div>\n\n    <div class="work-cta-row"';

export function splitGrid(html) {
  const a = html.indexOf(GRID_OPEN);
  const b = html.indexOf(GRID_CLOSE, a);
  if (a < 0 || b < 0) throw new Error('bloco .work-grid não encontrado no index.html');
  return { before: html.slice(0, a + GRID_OPEN.length), grid: html.slice(a + GRID_OPEN.length, b), after: html.slice(b) };
}

// Um card; `index` (0-based) decide a alternância `reverse`.
export function renderCard(p, index) {
  const tags = (p.home_tags || []).map(t => `              <span class="tag">${encode(t)}</span>`).join('\n');
  return `
      <!-- ${encode(p.slug)} -->
      <article class="work-case${index % 2 ? ' reverse' : ''}" data-cursor="view" data-category="${encode(p.home_category)}">
        <a href="/projeto.html?slug=${encode(p.slug)}" class="work-case-link">
          <div class="work-case-media" data-parallax="${formatParallax(p.home_parallax)}">
            <div class="work-case-img tilt-3d" data-tilt>
              <img src="${encode(p.thumbnail_url)}" alt="${encode(p.home_alt)}" loading="lazy"${p.home_img_style ? ` style="${encode(p.home_img_style)}"` : ''}>
              <div class="work-case-overlay"></div>
            </div>
          </div>
          <div class="work-case-info">
            <div class="work-case-tags">
${tags}
            </div>
            <h3 class="work-case-title" data-split-chars>${encode(p.home_title)}</h3>
            <p class="work-case-desc" data-reveal>${encode(p.home_desc)}</p>
            <span class="work-case-year">${encode(p.home_year)}</span>
          </div>
        </a>
      </article>
`;
}

export const renderGrid = projects => '\n' + projects.map(renderCard).join('');

const formatParallax = v => (v === null || v === undefined ? '0' : String(Number(v)));

// Remove comentários HTML (a única parte do bloco original que não segue regra: numeração e encoding mistos).
export const stripComments = s => s.replace(/\n[ \t]*<!--[\s\S]*?-->/g, '');

// index.html atual -> campos home_* por slug, na ordem da página.
export function parseCards(html) {
  const { grid } = splitGrid(html);
  return [...grid.matchAll(/<article class="work-case( reverse)?" data-cursor="view" data-category="([^"]*)">([\s\S]*?)<\/article>/g)].map((m, i) => {
    const b = m[3];
    const pick = re => (b.match(re) || [])[1];
    return {
      slug: decode(pick(/slug=([^"]+)"/)),
      reverse: !!m[1],
      home_category: decode(m[2]),
      home_parallax: Number(pick(/data-parallax="([^"]*)"/)),
      thumbnail_url: decode(pick(/<img src="([^"]*)"/)),
      home_alt: decode(pick(/<img src="[^"]*" alt="([^"]*)"/)),
      home_img_style: pick(/loading="lazy" style="([^"]*)"/) ? decode(pick(/loading="lazy" style="([^"]*)"/)) : null,
      home_tags: [...b.matchAll(/<span class="tag">([^<]*)<\/span>/g)].map(t => decode(t[1])),
      home_title: decode(pick(/data-split-chars>([^<]*)</)),
      home_desc: decode(pick(/data-reveal>([^<]*)</)),
      home_year: decode(pick(/work-case-year">([^<]*)</)),
      position: i,
    };
  });
}
