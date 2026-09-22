// Pré-build: lê `projects` visíveis do Supabase e gera a lista da home (index.html) e o
// public/data/portfolio-data.json. Só reescreve um arquivo quando os dados diferem do que ele já
// contém — com os dados iguais, o HTML/JSON servidos ficam byte a byte iguais aos de antes.
// Falha o build se o Supabase não responder (a produção fica no último deploy bom).
import fs from 'fs';
import { splitGrid, renderGrid, stripComments } from './lib/cards.mjs';
import { splitSection, renderSection } from './lib/sites-section.mjs';

const { SUPABASE_URL, SUPABASE_ANON_KEY, HUB_ALLOW_EMPTY } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('SUPABASE_URL/SUPABASE_ANON_KEY ausentes no build');

const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?visible=eq.true&select=*&order=sort_order.asc,slug.asc`, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
});
if (!res.ok) throw new Error(`Supabase respondeu ${res.status}: ${await res.text()}`);
const projects = await res.json();
if (!projects.length && !HUB_ALLOW_EMPTY) throw new Error('nenhum projeto visível — build abortado (HUB_ALLOW_EMPTY=1 para permitir)');

// portfolio-data.json: mesmo formato de objeto que projetos.js/projeto.js leem
const jsonPath = new URL('../public/data/portfolio-data.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const asJson = p => ({
  id: p.slug,
  slug: p.slug,
  title: p.title,
  subtitle: p.subtitle,
  category: p.category,
  year: p.year,
  client: p.client,
  role: p.role,
  cover: p.thumbnail_url,
  coverAlt: p.cover_alt,
  tags: p.tags,
  featured: p.featured,
  images: p.gallery_urls,
  ...(p.video_urls?.length ? { videos: p.video_urls } : {}),
});
const nextProjects = projects.map(asJson);
if (JSON.stringify(nextProjects) !== JSON.stringify(data.projects)) {
  data.projects = nextProjects;
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n');
  console.log(`generate: portfolio-data.json reescrito (${nextProjects.length} projetos)`);
} else {
  console.log('generate: portfolio-data.json inalterado');
}

// index.html: bloco .work-grid
const htmlPath = new URL('../index.html', import.meta.url);
const html = fs.readFileSync(htmlPath, 'utf8');
const { before, grid, after } = splitGrid(html);
const nextGrid = renderGrid(projects);
if (stripComments(nextGrid) !== stripComments(grid)) {
  fs.writeFileSync(htmlPath, before + nextGrid + after);
  console.log(`generate: index.html reescrito (${projects.length} cards)`);
} else {
  console.log('generate: index.html inalterado');
}
console.log('generate: slugs públicos =', projects.map(p => p.slug).join(','));

// Seção "Sites desenvolvidos": view pública home_sites (só os marcados para a home, 5 colunas)
const rs = await fetch(`${SUPABASE_URL}/rest/v1/home_sites?select=*&order=sort.asc.nullslast,name.asc`, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
});
if (!rs.ok) throw new Error(`Supabase (home_sites) respondeu ${rs.status}: ${await rs.text()}`);
const sites = await rs.json();
const html2 = fs.readFileSync(htmlPath, 'utf8');
if (!sites.length) {
  console.log('generate: nenhum site marcado para a home — seção mantida como está');
} else {
  const sec = splitSection(html2);
  const next = renderSection(sites);
  if (next !== sec.section) {
    fs.writeFileSync(htmlPath, sec.before + next + sec.after);
    console.log(`generate: seção Sites reescrita (${sites.length} sites)`);
  } else {
    console.log('generate: seção Sites inalterada');
  }
}
