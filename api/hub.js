// API do hub: POST /api/hub  { "action": "...", ...params }
// Auth: `Authorization: Bearer <HUB_API_TOKEN>` (CLI/Claude) ou `Bearer <JWT do Supabase>` do dono (admin).
// Toda escrita usa a service_role, que só existe aqui (env server-side). Mutação em `projects`
// dispara o Deploy Hook para o site público refletir sem deploy manual.
import { timingSafeEqual } from 'crypto';

const OWNER = 'viniciusal60@gmail.com';
const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, HUB_API_TOKEN, VERCEL_DEPLOY_HOOK } = process.env;
const SVC = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' };

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

async function authorize(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) throw new HttpError(401, 'não autenticado');
  const tok = m[1];
  if (HUB_API_TOKEN && tok.length === HUB_API_TOKEN.length && timingSafeEqual(Buffer.from(tok), Buffer.from(HUB_API_TOKEN))) return 'token';
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${tok}` } });
  if (r.ok && ((await r.json()).email || '').toLowerCase() === OWNER) return 'sessao';
  throw new HttpError(401, 'não autenticado');
}

async function db(method, path, body, prefer = 'return=representation') {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers: { ...SVC, Prefer: prefer }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) throw new HttpError(r.status === 409 ? 409 : 400, `banco: ${t}`);
  return t ? JSON.parse(t) : null;
}

async function storage(path, body) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/${path}`, { method: 'POST', headers: SVC, body: JSON.stringify(body || {}) });
  const t = await r.text();
  if (!r.ok) throw new HttpError(400, `storage: ${t}`);
  return t ? JSON.parse(t) : null;
}

async function publish(reason) {
  if (!VERCEL_DEPLOY_HOOK) return { published: false, reason: 'VERCEL_DEPLOY_HOOK ausente neste ambiente' };
  const r = await fetch(VERCEL_DEPLOY_HOOK, { method: 'POST' });
  const j = await r.json().catch(() => ({}));
  return { published: r.ok, job: j.job?.id || null, reason };
}

const eq = v => `eq.${encodeURIComponent(v)}`;
const need = (o, ...keys) => { for (const k of keys) if (o[k] === undefined || o[k] === null || o[k] === '') throw new HttpError(400, `campo obrigatório: ${k}`); };
const cents = v => { if (!Number.isInteger(v) || v < 0) throw new HttpError(400, 'amount_cents deve ser inteiro >= 0 (centavos)'); return v; };
const one = rows => { if (!rows?.length) throw new HttpError(404, 'não encontrado'); return rows[0]; };

const PROJECT_FIELDS = ['slug', 'title', 'subtitle', 'category', 'year', 'client', 'role', 'thumbnail_url', 'cover_alt', 'gallery_urls', 'video_urls', 'tags', 'stack', 'url_official', 'url_vercel', 'url_repo', 'home_title', 'home_desc', 'home_tags', 'home_category', 'home_year', 'home_alt', 'home_parallax', 'home_img_style', 'visible', 'featured', 'sort_order'];
const SITE_FIELDS = ['name', 'client', 'category', 'platform', 'vercel_project', 'vercel_url', 'official_url', 'reference_url', 'vercel_state', 'http_vercel', 'http_official', 'checked_at', 'source_note', 'source_status', 'notes'];
const pick = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => keys.includes(k)));

const actions = {
  // ── projetos ──
  'projects.list': () => db('GET', 'projects?select=*&order=sort_order.asc,slug.asc'),
  'projects.get': ({ slug }) => db('GET', `projects?slug=${eq(slug)}&select=*`).then(one),
  'projects.create': async ({ project }) => {
    need(project || {}, 'slug', 'title');
    const row = pick(project, PROJECT_FIELDS);
    if (row.sort_order === undefined) {
      const last = await db('GET', 'projects?select=sort_order&order=sort_order.desc&limit=1');
      row.sort_order = (last[0]?.sort_order || 0) + 10;
    }
    const created = one(await db('POST', 'projects', row));
    return { project: created, publish: created.visible ? await publish('projects.create') : { published: false, reason: 'projeto oculto' } };
  },
  'projects.update': async ({ slug, patch }) => {
    need({ slug }, 'slug');
    const updated = one(await db('PATCH', `projects?slug=${eq(slug)}`, pick(patch, PROJECT_FIELDS)));
    return { project: updated, publish: await publish('projects.update') };
  },
  'projects.hide': ({ slug }) => actions['projects.update']({ slug, patch: { visible: false } }),
  'projects.show': ({ slug }) => actions['projects.update']({ slug, patch: { visible: true } }),
  'projects.reorder': async ({ slugs }) => {
    if (!Array.isArray(slugs) || !slugs.length) throw new HttpError(400, 'slugs: lista na nova ordem');
    const all = await db('GET', 'projects?select=slug');
    const known = new Set(all.map(p => p.slug));
    const unknown = slugs.filter(s => !known.has(s));
    if (unknown.length) throw new HttpError(400, `slugs inexistentes: ${unknown.join(',')}`);
    for (const [i, s] of slugs.entries()) await db('PATCH', `projects?slug=${eq(s)}`, { sort_order: (i + 1) * 10 }, 'return=minimal');
    return { order: slugs, publish: await publish('projects.reorder') };
  },
  'projects.delete': async ({ slug }) => {
    need({ slug }, 'slug');
    const gone = one(await db('DELETE', `projects?slug=${eq(slug)}`));
    return { deleted: gone.slug, publish: await publish('projects.delete') };
  },
  publish: () => publish('manual'),

  // ── clientes / jobs ──
  'clients.list': () => db('GET', 'clients?select=*&order=name.asc'),
  'clients.create': ({ client }) => { need(client || {}, 'name'); return db('POST', 'clients', pick(client, ['name', 'contact', 'notes'])).then(one); },
  'clients.update': ({ id, patch }) => db('PATCH', `clients?id=${eq(id)}`, pick(patch, ['name', 'contact', 'notes'])).then(one),
  'clients.delete': ({ id }) => db('DELETE', `clients?id=${eq(id)}`).then(one),
  'jobs.list': () => db('GET', 'jobs?select=*,client:clients(id,name),project:projects(slug,title)&order=created_at.desc'),
  'jobs.create': ({ job }) => { need(job || {}, 'title'); return db('POST', 'jobs', pick(job, ['client_id', 'project_id', 'title', 'type', 'status', 'started_at', 'delivered_at', 'notes'])).then(one); },
  'jobs.update': ({ id, patch }) => db('PATCH', `jobs?id=${eq(id)}`, pick(patch, ['client_id', 'project_id', 'title', 'type', 'status', 'started_at', 'delivered_at', 'notes'])).then(one),
  'jobs.delete': ({ id }) => db('DELETE', `jobs?id=${eq(id)}`).then(one),

  // ── financeiro (centavos) ──
  'payments.list': () => db('GET', 'payments?select=*,job:jobs(id,title,client:clients(name))&order=due_date.desc.nullslast'),
  'payments.create': ({ payment }) => {
    need(payment || {}, 'job_id', 'amount_cents');
    cents(payment.amount_cents);
    return db('POST', 'payments', pick(payment, ['job_id', 'amount_cents', 'currency', 'due_date', 'paid_at', 'status', 'nf_emitida', 'notes'])).then(one);
  },
  'payments.update': ({ id, patch }) => {
    if (patch?.amount_cents !== undefined) cents(patch.amount_cents);
    return db('PATCH', `payments?id=${eq(id)}`, pick(patch, ['job_id', 'amount_cents', 'currency', 'due_date', 'paid_at', 'status', 'nf_emitida', 'notes'])).then(one);
  },
  'payments.delete': ({ id }) => db('DELETE', `payments?id=${eq(id)}`).then(one),
  'expenses.list': () => db('GET', 'expenses?select=*&order=date.desc'),
  'expenses.create': ({ expense }) => {
    need(expense || {}, 'category', 'amount_cents', 'date');
    cents(expense.amount_cents);
    return db('POST', 'expenses', pick(expense, ['category', 'amount_cents', 'currency', 'date', 'recorrente', 'notes'])).then(one);
  },
  'expenses.delete': ({ id }) => db('DELETE', `expenses?id=${eq(id)}`).then(one),

  'dashboard.summary': async () => {
    const [payments, jobs, expenses] = await Promise.all([
      db('GET', 'payments?select=amount_cents,currency,status,due_date,paid_at,job:jobs(client:clients(name))'),
      db('GET', 'jobs?select=status'),
      db('GET', 'expenses?select=amount_cents,currency,date'),
    ]);
    const now = new Date(Date.now() - 3 * 3600e3); // America/Sao_Paulo
    const today = now.toISOString().slice(0, 10), ym = today.slice(0, 7), y = today.slice(0, 4);
    const by = {};
    const add = (cur, k, v) => { by[cur] ??= { faturado_mes: 0, faturado_ano: 0, a_receber: 0, atrasado: 0, despesas_mes: 0, receita_por_mes: {}, receita_por_cliente: {} }; by[cur][k] += v; };
    for (const p of payments) {
      const cur = p.currency;
      if (p.status === 'pago' && p.paid_at) {
        if (p.paid_at.startsWith(ym)) add(cur, 'faturado_mes', p.amount_cents);
        if (p.paid_at.startsWith(y)) {
          add(cur, 'faturado_ano', p.amount_cents);
          const cli = p.job?.client?.name || '(sem cliente)';
          by[cur].receita_por_cliente[cli] = (by[cur].receita_por_cliente[cli] || 0) + p.amount_cents;
        }
        const m = p.paid_at.slice(0, 7);
        by[cur].receita_por_mes[m] = (by[cur].receita_por_mes[m] || 0) + p.amount_cents;
      } else if (p.status === 'pendente') {
        add(cur, 'a_receber', p.amount_cents);
        if (p.due_date && p.due_date < today) add(cur, 'atrasado', p.amount_cents);
      }
    }
    for (const e of expenses) if (e.date.startsWith(ym)) add(e.currency, 'despesas_mes', e.amount_cents);
    return { hoje: today, por_moeda: by, jobs_em_andamento: jobs.filter(j => j.status === 'em_andamento').length, jobs_total: jobs.length };
  },

  // ── sites desenvolvidos (catálogo privado) ──
  'sites.list': () => db('GET', 'sites?select=*,project:projects(slug,visible)&order=category.asc.nullslast,name.asc'),
  'sites.update': ({ id, patch }) => db('PATCH', `sites?id=${eq(id)}`, pick(patch, SITE_FIELDS)).then(one),
  // excluir tira só da lista do hub; não mexe no projeto da Vercel nem no site no ar
  'sites.delete': ({ id }) => db('DELETE', `sites?id=${eq(id)}`).then(one),
  // upsert por `key` (importação idempotente)
  'sites.import': async ({ sites }) => {
    if (!Array.isArray(sites) || !sites.length) throw new HttpError(400, 'sites: lista');
    // PostgREST exige as mesmas chaves em todas as linhas do lote
    const rows = sites.map(s => { need(s, 'key', 'name'); return Object.fromEntries(['key', ...SITE_FIELDS].map(k => [k, s[k] ?? null])); });
    return { upserted: (await db('POST', 'sites?on_conflict=key', rows, 'resolution=merge-duplicates,return=representation')).length };
  },
  // cria um projeto OCULTO do portfólio a partir do site (sem imagens; completar no admin antes de mostrar)
  'sites.to_project': async ({ id }) => {
    const s = one(await db('GET', `sites?id=${eq(id)}&select=*`));
    if (s.project_id) throw new HttpError(409, 'este site já tem projeto no portfólio');
    const base = (s.vercel_project || s.key.replace(/^(site|vercel):/, '')).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const taken = new Set((await db('GET', `projects?select=slug&slug=like.${encodeURIComponent(base)}*`)).map(p => p.slug));
    let slug = base; for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const project = one(await db('POST', 'projects', { slug, title: s.name, client: s.client, url_vercel: s.vercel_url, url_official: s.official_url, visible: false, sort_order: 9990 }));
    await db('PATCH', `sites?id=${eq(id)}`, { project_id: project.id }, 'return=minimal');
    return { project };
  },
  // em lote: cada item é independente; devolve o resultado de cada id
  'sites.to_project_many': async ({ ids }) => {
    if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'ids: lista');
    const results = [];
    for (const id of ids) {
      try { results.push({ id, ok: true, slug: (await actions['sites.to_project']({ id })).project.slug }); }
      catch (e) { results.push({ id, ok: false, error: e.message }); }
    }
    return { results, created: results.filter(r => r.ok).length };
  },
  'sites.delete_many': async ({ ids }) => {
    if (!Array.isArray(ids) || !ids.length) throw new HttpError(400, 'ids: lista');
    const gone = await db('DELETE', `sites?id=in.(${ids.map(encodeURIComponent).join(',')})`);
    return { deleted: gone.length };
  },

  // ── assets (storage) ──
  'assets.list': ({ q } = {}) => db('GET', `assets?select=*,project:projects(slug,title)&order=created_at.desc${q ? `&or=(title.ilike.*${encodeURIComponent(q)}*,tags.cs.{${encodeURIComponent(q)}})` : ''}`),
  // 1) pede URL de upload assinada  2) cliente faz PUT do arquivo  3) assets.create registra (bucket privado)
  'upload.sign': async ({ bucket, path }) => {
    if (!['public-media', 'private-assets'].includes(bucket)) throw new HttpError(400, 'bucket inválido');
    need({ path }, 'path');
    const safePath = String(path).replace(/[^a-zA-Z0-9._/-]+/g, '-').replace(/^\/+/, '');
    const j = await storage(`object/upload/sign/${bucket}/${safePath}`, {});
    return { bucket, path: safePath, upload_url: `${SUPABASE_URL}/storage/v1${j.url}`, public_url: bucket === 'public-media' ? `${SUPABASE_URL}/storage/v1/object/public/public-media/${safePath}` : null };
  },
  'assets.create': ({ asset }) => {
    need(asset || {}, 'storage_path');
    return db('POST', 'assets', pick(asset, ['bucket', 'storage_path', 'title', 'kind', 'tags', 'project_id', 'mime', 'size_bytes'])).then(one);
  },
  'assets.url': async ({ id, expires_in = 300 }) => {
    const a = one(await db('GET', `assets?id=${eq(id)}&select=bucket,storage_path`));
    if (a.bucket === 'public-media') return { url: `${SUPABASE_URL}/storage/v1/object/public/public-media/${a.storage_path}` };
    const j = await storage(`object/sign/private-assets/${a.storage_path}`, { expiresIn: Math.min(Math.max(+expires_in || 300, 30), 3600) });
    return { url: `${SUPABASE_URL}/storage/v1${j.signedURL}`, expires_in };
  },
  'assets.delete': async ({ id }) => {
    const a = one(await db('DELETE', `assets?id=${eq(id)}`));
    await fetch(`${SUPABASE_URL}/storage/v1/object/${a.bucket}`, { method: 'DELETE', headers: SVC, body: JSON.stringify({ prefixes: [a.storage_path] }) });
    return { deleted: a.id };
  },
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'use POST');
    await authorize(req);
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const fn = actions[body.action];
    if (!fn) throw new HttpError(400, `ação desconhecida. Disponíveis: ${Object.keys(actions).join(', ')}`);
    res.status(200).json({ ok: true, data: await fn(body) });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'erro interno' });
  }
}
