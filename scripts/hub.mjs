#!/usr/bin/env node
// CLI do hub — chama POST /api/hub com o token (mesmas ações do admin).
// Config por env: HUB_URL (ex.: https://vini-portfolio-v2.vercel.app), HUB_API_TOKEN,
// e VERCEL_BYPASS (só para preview atrás do SSO da Vercel).
//
//   node scripts/hub.mjs call <action> '<json>'          qualquer ação da API
//   node scripts/hub.mjs projects                         lista projetos (ordem, visível)
//   node scripts/hub.mjs hide <slug> | show <slug>        oculta/mostra no site público
//   node scripts/hub.mjs reorder <slug1> <slug2> ...      nova ordem pública
//   node scripts/hub.mjs job:add '<json job>'             ex.: '{"title":"Site X","type":"site","status":"em_andamento"}'
//   node scripts/hub.mjs payment:add <job_id> <reais> [vencimento AAAA-MM-DD] [pago AAAA-MM-DD]
//   node scripts/hub.mjs summary                          dashboard (centavos)
//   node scripts/hub.mjs upload <public-media|private-assets> <arquivo> [destino] [titulo]
import fs from 'fs';
import path from 'path';

const { HUB_URL, HUB_API_TOKEN, VERCEL_BYPASS } = process.env;
if (!HUB_URL || !HUB_API_TOKEN) { console.error('defina HUB_URL e HUB_API_TOKEN'); process.exit(2); }
const bypass = VERCEL_BYPASS ? { 'x-vercel-protection-bypass': VERCEL_BYPASS } : {};

async function call(action, params = {}) {
  const r = await fetch(`${HUB_URL.replace(/\/$/, '')}/api/hub`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HUB_API_TOKEN}`, 'content-type': 'application/json', ...bypass },
    body: JSON.stringify({ action, ...params }),
  });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (!j.ok) { console.error(`erro (${r.status}): ${j.error}`); process.exit(1); }
  return j.data;
}

// "1.234,56" | "1234.56" | "1500" -> centavos inteiros, sem float
function reaisToCents(s) {
  const t = String(s).trim().replace(/\./g, (m, i, all) => (all.includes(',') ? '' : m)).replace(',', '.');
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) throw new Error(`valor inválido: ${s}`);
  return Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0'));
}

const [cmd, ...a] = process.argv.slice(2);
const print = d => console.log(JSON.stringify(d, null, 2));

switch (cmd) {
  case 'call': print(await call(a[0], a[1] ? JSON.parse(a[1]) : {})); break;
  case 'projects': {
    const ps = await call('projects.list');
    for (const p of ps) console.log(`${String(p.sort_order).padStart(4)}  ${p.visible ? 'visível' : 'oculto '}  ${p.featured ? '★' : ' '}  ${p.slug}  —  ${p.title}`);
    break;
  }
  case 'hide': print(await call('projects.hide', { slug: a[0] })); break;
  case 'show': print(await call('projects.show', { slug: a[0] })); break;
  case 'reorder': print(await call('projects.reorder', { slugs: a })); break;
  case 'job:add': print(await call('jobs.create', { job: JSON.parse(a[0]) })); break;
  case 'payment:add': {
    const [job_id, reais, due_date, paid_at] = a;
    print(await call('payments.create', { payment: { job_id, amount_cents: reaisToCents(reais), due_date: due_date || null, paid_at: paid_at || null, status: paid_at ? 'pago' : 'pendente' } }));
    break;
  }
  case 'summary': print(await call('dashboard.summary')); break;
  case 'upload': {
    const [bucket, file, dest, title] = a;
    const buf = fs.readFileSync(file);
    const target = dest || `${new Date().toISOString().slice(0, 10)}/${path.basename(file)}`;
    const s = await call('upload.sign', { bucket, path: target });
    const put = await fetch(s.upload_url, { method: 'PUT', headers: { 'content-type': mime(file) }, body: buf });
    if (!put.ok) { console.error('upload falhou:', put.status, await put.text()); process.exit(1); }
    const asset = await call('assets.create', { asset: { bucket, storage_path: s.path, title: title || path.basename(file), mime: mime(file), size_bytes: buf.length } });
    print({ asset, public_url: s.public_url });
    break;
  }
  default:
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).join('\n'));
}

function mime(f) {
  return { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.zip': 'application/zip', '.txt': 'text/plain' }[path.extname(f).toLowerCase()] || 'application/octet-stream';
}
