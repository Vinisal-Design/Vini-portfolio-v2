// Migração única e idempotente: index.html (cards da home) + portfolio-data.json -> tabela `projects`.
// Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-projects.mjs [--dry]
// Upsert por slug; a ordem atual da home vira sort_order (10, 20, 30...). Todos entram visible=true.
import fs from 'fs';
import { parseCards } from './lib/cards.mjs';

const DRY = process.argv.includes('--dry');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(fs.readFileSync(new URL('../public/data/portfolio-data.json', import.meta.url), 'utf8'));
const cards = parseCards(html);

const homeSlugs = cards.map(c => c.slug);
const jsonSlugs = data.projects.map(p => p.slug);
if (JSON.stringify(homeSlugs) !== JSON.stringify(jsonSlugs)) {
  throw new Error(`home e JSON divergem em slugs/ordem:\nhome ${homeSlugs}\njson ${jsonSlugs}`);
}

const rows = data.projects.map((p, i) => {
  const c = cards[i];
  if (c.thumbnail_url !== p.cover) throw new Error(`${p.slug}: capa da home (${c.thumbnail_url}) != cover do JSON (${p.cover})`);
  return {
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle,
    category: p.category,
    year: p.year,
    client: p.client,
    role: p.role,
    thumbnail_url: p.cover,
    cover_alt: p.coverAlt,
    gallery_urls: p.images || [],
    video_urls: p.videos || [],
    tags: p.tags || [],
    featured: !!p.featured,
    visible: true,
    sort_order: (i + 1) * 10,
    home_title: c.home_title,
    home_desc: c.home_desc,
    home_tags: c.home_tags,
    home_category: c.home_category,
    home_year: c.home_year,
    home_alt: c.home_alt,
    home_parallax: c.home_parallax,
    home_img_style: c.home_img_style,
  };
});

// Relatório de cobertura: campo original -> coluna; o que o original não tem, listado por projeto.
const ORIGINAL_KEYS = ['id', 'slug', 'title', 'subtitle', 'category', 'year', 'client', 'role', 'cover', 'coverAlt', 'tags', 'featured', 'images', 'videos'];
const NOT_IN_ORIGINAL = ['stack', 'url_official', 'url_vercel', 'url_repo'];
for (const [i, p] of data.projects.entries()) {
  const keys = Object.keys(p);
  const unknown = keys.filter(k => !ORIGINAL_KEYS.includes(k));
  if (unknown.length) throw new Error(`${p.slug}: campo original sem destino: ${unknown}`);
  console.log(`${p.slug} | originais: ${keys.join(',')} + card home (7 campos${rows[i].home_img_style ? ' + style' : ''}) | vazios por não existirem no original: ${NOT_IN_ORIGINAL.join(',')}${p.videos ? '' : ',video_urls'}`);
}

if (DRY) { console.log(JSON.stringify(rows, null, 1)); process.exit(0); }

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const r = await fetch(`${SUPABASE_URL}/rest/v1/projects?on_conflict=slug`, {
  method: 'POST',
  headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(rows),
});
if (!r.ok) throw new Error(`upsert falhou: ${r.status} ${await r.text()}`);
console.log(`upsert: ${(await r.json()).length} projetos`);
