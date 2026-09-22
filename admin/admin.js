import './admin.css';
import { createClient } from '@supabase/supabase-js';

// Injetados no build (vite.config.js `define`) a partir das env da Vercel. A anon key é pública por natureza.
const sb = createClient(__HUB_SUPABASE_URL__, __HUB_SUPABASE_ANON_KEY__, { auth: { persistSession: true, autoRefreshToken: true } });

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = (c, cur = 'BRL') => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur }).format((c || 0) / 100);
const toCents = s => {
  const t = String(s).trim().replace(/\s/g, '').replace(/^R\$/, '');
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(norm);
  if (!m) throw new Error('Valor inválido. Use 1.500,00');
  return Number(m[1]) * 100 + Number((m[2] || '0').padEnd(2, '0'));
};
const list = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

function toast(msg, err = false) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = 'toast'), 3200);
}

async function api(action, params = {}) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showLogin(); throw new Error('sessão expirada'); }
  const r = await fetch('/api/hub', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ action, ...params }) });
  const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
  if (r.status === 401) { await sb.auth.signOut(); showLogin(); }
  if (!j.ok) throw new Error(j.error);
  return j.data;
}
const published = d => d?.publish?.published ? ' · site público atualiza em ~1 min' : '';

// ── Auth ──────────────────────────────────────────────
function showLogin() { $('#app').hidden = true; $('#login').hidden = false; $('#view').innerHTML = ''; }
async function showApp() { $('#login').hidden = true; $('#app').hidden = false; go(location.hash.slice(1) || 'dashboard'); }

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn'); btn.disabled = true; $('#loginMsg').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
  btn.disabled = false;
  if (error) { $('#loginMsg').textContent = 'E-mail ou senha inválidos.'; return; } // mensagem neutra
  $('#password').value = '';
  showApp();
});
$('#logout').addEventListener('click', async () => { await sb.auth.signOut(); showLogin(); });

// ── Navegação ─────────────────────────────────────────
const views = { dashboard, projects, sites, finance, assets };
function go(tab) {
  if (!views[tab]) tab = 'dashboard';
  location.hash = tab;
  $$('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('#view').innerHTML = '<p class="muted">Carregando…</p>';
  views[tab]().catch(e => { $('#view').innerHTML = `<p class="msg">${esc(e.message)}</p>`; });
}
$$('.tab').forEach(b => b.addEventListener('click', () => go(b.dataset.tab)));

// ── Gráficos (SVG simples) ────────────────────────────
function bars(entries, { horizontal = false } = {}) {
  if (!entries.length) return '<p class="empty">Sem receita paga no período.</p>';
  const max = Math.max(...entries.map(e => e[1]), 1);
  if (horizontal) {
    const h = entries.length * 34;
    return `<svg viewBox="0 0 600 ${h}" role="img">${entries.map(([k, v], i) => `
      <text x="0" y="${i * 34 + 14}" fill="#8c8c8c" font-size="12">${esc(k)}</text>
      <rect x="0" y="${i * 34 + 19}" width="${Math.max(2, (v / max) * 470)}" height="10" rx="5" fill="#ff5b46"/>
      <text x="${Math.max(2, (v / max) * 470) + 8}" y="${i * 34 + 28}" fill="#f2f2f2" font-size="12">${esc(brl(v))}</text>`).join('')}</svg>`;
  }
  const w = 600, h = 200, bw = w / entries.length;
  return `<svg viewBox="0 0 ${w} ${h + 34}" role="img">${entries.map(([k, v], i) => {
    const bh = (v / max) * h;
    return `<rect x="${i * bw + bw * .18}" y="${h - bh}" width="${bw * .64}" height="${Math.max(bh, 1)}" rx="4" fill="#ff5b46"><title>${esc(k)}: ${esc(brl(v))}</title></rect>
      <text x="${i * bw + bw / 2}" y="${h + 16}" fill="#8c8c8c" font-size="11" text-anchor="middle">${esc(k.slice(5))}/${esc(k.slice(2, 4))}</text>`;
  }).join('')}</svg>`;
}
function last12(map) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = 11; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); const k = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; out.push([k, map[k] || 0]); }
  return out;
}

// ── Dashboard ─────────────────────────────────────────
async function dashboard() {
  const s = await api('dashboard.summary');
  const brlData = s.por_moeda.BRL || { faturado_mes: 0, faturado_ano: 0, a_receber: 0, atrasado: 0, despesas_mes: 0, receita_por_mes: {}, receita_por_cliente: {} };
  const outras = Object.entries(s.por_moeda).filter(([c]) => c !== 'BRL');
  $('#view').innerHTML = `
    <div class="row between"><h2>Dashboard</h2><span class="muted">${esc(s.hoje)} · BRL</span></div>
    <div class="kpis">
      <div class="card kpi"><div class="v">${brl(brlData.faturado_mes)}</div><div class="l">Faturado no mês</div></div>
      <div class="card kpi"><div class="v">${brl(brlData.faturado_ano)}</div><div class="l">Faturado no ano</div></div>
      <div class="card kpi"><div class="v">${brl(brlData.a_receber)}</div><div class="l">A receber</div></div>
      <div class="card kpi ${brlData.atrasado ? 'bad' : ''}"><div class="v">${brl(brlData.atrasado)}</div><div class="l">Atrasado</div></div>
      <div class="card kpi"><div class="v">${s.jobs_em_andamento}</div><div class="l">Jobs em andamento (de ${s.jobs_total})</div></div>
    </div>
    <div class="grid2">
      <div class="card chart"><h3>Receita por mês (12 meses)</h3>${bars(last12(brlData.receita_por_mes))}</div>
      <div class="card chart"><h3>Receita por cliente (ano)</h3>${bars(Object.entries(brlData.receita_por_cliente).sort((a, b) => b[1] - a[1]), { horizontal: true })}</div>
    </div>
    ${outras.length ? `<div class="card"><h3>Outras moedas</h3>${outras.map(([c, v]) => `<p>${esc(c)}: faturado ano ${brl(v.faturado_ano, c)} · a receber ${brl(v.a_receber, c)}</p>`).join('')}</div>` : ''}
    <p class="muted">Despesas do mês: ${brl(brlData.despesas_mes)}</p>`;
}

// ── Projetos ──────────────────────────────────────────
async function projects() {
  const ps = await api('projects.list');
  $('#view').innerHTML = `
    <div class="row between"><h2>Projetos</h2><div class="row"><button class="btn" id="saveOrder" hidden>Salvar ordem</button><button class="btn primary" id="newProject">Novo projeto</button></div></div>
    <p class="muted">Arraste pela alça ⋮⋮ para reordenar. Visível/destaque e ordem valem para o site público após a publicação automática (~1 min).</p>
    <div class="card table-wrap"><table>
      <thead><tr><th></th><th></th><th>Projeto</th><th>Ordem</th><th>Visível</th><th>Destaque</th><th></th></tr></thead>
      <tbody id="projRows">${ps.map(p => `
        <tr draggable="true" data-slug="${esc(p.slug)}">
          <td class="handle" title="Arrastar">⋮⋮</td>
          <td>${p.thumbnail_url ? `<img class="thumb" src="${esc(p.thumbnail_url)}" alt="" loading="lazy">` : '<span class="thumb"></span>'}</td>
          <td><strong>${esc(p.title)}</strong><br><span class="muted">${esc(p.slug)}</span></td>
          <td>${p.sort_order}</td>
          <td><label class="switch"><input type="checkbox" data-toggle="visible" ${p.visible ? 'checked' : ''}><span></span></label></td>
          <td><label class="switch"><input type="checkbox" data-toggle="featured" ${p.featured ? 'checked' : ''}><span></span></label></td>
          <td><button class="btn sm" data-edit>Editar</button></td>
        </tr>`).join('')}</tbody>
    </table></div>`;

  $$('[data-toggle]').forEach(inp => inp.addEventListener('change', async () => {
    const slug = inp.closest('tr').dataset.slug; inp.disabled = true;
    try { const d = await api('projects.update', { slug, patch: { [inp.dataset.toggle]: inp.checked } }); toast(`${slug}: ${inp.dataset.toggle} = ${inp.checked ? 'sim' : 'não'}${published(d)}`); }
    catch (e) { inp.checked = !inp.checked; toast(e.message, true); }
    inp.disabled = false;
  }));
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => projectForm(ps.find(p => p.slug === b.closest('tr').dataset.slug))));
  $('#newProject').addEventListener('click', () => projectForm(null));

  // drag de ordem
  const tbody = $('#projRows'); let dragged = null;
  tbody.addEventListener('dragstart', e => { dragged = e.target.closest('tr'); dragged.classList.add('dragging'); });
  tbody.addEventListener('dragend', () => { dragged?.classList.remove('dragging'); $$('.drop-target').forEach(r => r.classList.remove('drop-target')); });
  tbody.addEventListener('dragover', e => {
    e.preventDefault(); const tr = e.target.closest('tr'); if (!tr || tr === dragged) return;
    $$('.drop-target').forEach(r => r.classList.remove('drop-target')); tr.classList.add('drop-target');
    const after = e.clientY > tr.getBoundingClientRect().top + tr.offsetHeight / 2;
    tbody.insertBefore(dragged, after ? tr.nextSibling : tr); $('#saveOrder').hidden = false;
  });
  $('#saveOrder').addEventListener('click', async () => {
    const slugs = $$('#projRows tr').map(r => r.dataset.slug);
    try { const d = await api('projects.reorder', { slugs }); toast('Ordem salva' + published(d)); projects(); } catch (e) { toast(e.message, true); }
  });
}

function projectForm(p) {
  const isNew = !p; p = p || { visible: false, featured: false, tags: [], home_tags: [], gallery_urls: [], video_urls: [], stack: [] };
  const f = (k, label, type = 'text') => `<label>${label}<input name="${k}" type="${type}" value="${esc(p[k] ?? '')}" ${k === 'slug' && !isNew ? 'readonly' : ''}></label>`;
  const a = (k, label) => `<label>${label} <span class="muted">(separado por vírgula)</span><input name="${k}" value="${esc((p[k] || []).join(', '))}"></label>`;
  const t = (k, label) => `<label>${label}<textarea name="${k}">${esc((p[k] || []).join('\n'))}</textarea></label>`;
  $('#modalBody').innerHTML = `
    <form id="pForm" class="form-grid">
      <div class="row between"><h2>${isNew ? 'Novo projeto' : esc(p.title)}</h2><button type="button" class="btn ghost" id="close">Fechar</button></div>
      <div class="form-grid two">${f('slug', 'Slug')}${f('title', 'Título')}${f('subtitle', 'Subtítulo')}${f('category', 'Categoria')}${f('year', 'Ano')}${f('client', 'Cliente')}${f('role', 'Função')}${f('cover_alt', 'Alt da capa')}</div>
      <div class="card form-grid">
        <h3>Capa</h3>
        <div class="row">${p.thumbnail_url ? `<img class="thumb" src="${esc(p.thumbnail_url)}" alt="">` : ''}<input name="thumbnail_url" value="${esc(p.thumbnail_url ?? '')}" placeholder="/projects/... ou URL pública"></div>
        <label>Enviar nova capa (public-media)<input type="file" id="thumbFile" accept="image/*"></label>
      </div>
      ${t('gallery_urls', 'Galeria (1 URL por linha)')}${t('video_urls', 'Vídeos (1 URL por linha)')}
      <div class="form-grid two">${a('tags', 'Tags')}${a('stack', 'Stack')}${f('url_official', 'URL oficial', 'url')}${f('url_vercel', 'URL Vercel', 'url')}${f('url_repo', 'URL repositório', 'url')}</div>
      <div class="card form-grid"><h3>Card da home</h3><div class="form-grid two">${f('home_title', 'Título no card')}${f('home_desc', 'Descrição no card')}${a('home_tags', 'Tags no card')}${f('home_category', 'Categoria (filtro)')}${f('home_year', 'Ano no card')}${f('home_alt', 'Alt da imagem')}${f('home_parallax', 'Parallax', 'number')}${f('home_img_style', 'Style da imagem')}</div></div>
      <div class="row"><label class="row"><input type="checkbox" name="visible" ${p.visible ? 'checked' : ''} style="width:auto"> Visível</label><label class="row"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''} style="width:auto"> Destaque</label></div>
      <div class="row between">${isNew ? '<span></span>' : '<button type="button" class="btn danger" id="del">Excluir</button>'}<button class="btn primary">Salvar</button></div>
      <p class="msg" id="pMsg"></p>
    </form>`;
  const dlg = $('#modal'); dlg.showModal();
  $('#close').onclick = () => dlg.close();
  $('#thumbFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    const slug = $('[name=slug]').value.trim() || 'sem-slug';
    try {
      const s = await api('upload.sign', { bucket: 'public-media', path: `projects/${slug}/${Date.now()}-${file.name}` });
      const r = await fetch(s.upload_url, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!r.ok) throw new Error('upload falhou: ' + r.status);
      $('[name=thumbnail_url]').value = s.public_url; toast('Capa enviada — salve para aplicar');
    } catch (err) { toast(err.message, true); }
  };
  if (!isNew) $('#del').onclick = async () => {
    if (!confirm(`Excluir ${p.slug}? Isso tira o projeto do banco (as imagens ficam).`)) return;
    try { await api('projects.delete', { slug: p.slug }); dlg.close(); toast('Excluído'); projects(); } catch (err) { toast(err.message, true); }
  };
  $('#pForm').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target); const o = {};
    for (const k of ['slug', 'title', 'subtitle', 'category', 'year', 'client', 'role', 'cover_alt', 'thumbnail_url', 'url_official', 'url_vercel', 'url_repo', 'home_title', 'home_desc', 'home_category', 'home_year', 'home_alt', 'home_img_style']) o[k] = (fd.get(k) || '').trim() || null;
    for (const k of ['tags', 'stack', 'home_tags']) o[k] = list(fd.get(k));
    for (const k of ['gallery_urls', 'video_urls']) o[k] = String(fd.get(k) || '').split('\n').map(x => x.trim()).filter(Boolean);
    o.home_parallax = fd.get('home_parallax') === '' ? null : Number(fd.get('home_parallax'));
    o.visible = fd.get('visible') === 'on'; o.featured = fd.get('featured') === 'on';
    try {
      const d = isNew ? await api('projects.create', { project: o }) : await api('projects.update', { slug: p.slug, patch: o });
      dlg.close(); toast('Salvo' + published(d)); projects();
    } catch (err) { $('#pMsg').textContent = err.message; }
  };
}

// ── Sites desenvolvidos ───────────────────────────────
const CAT_LABEL = { freelance: 'Freelance', cliente: 'Cliente', 'a-formula': 'A Fórmula', lab: 'Lab', pessoal: 'Pessoal', 'sem-nota': 'Sem nota' };
const httpPill = code => !code ? '' : code >= 200 && code < 400 ? `<span class="pill ok">${code}</span>` : code === 401 || code === 403 ? `<span class="pill warn" title="protegido (login da Vercel)">${code}</span>` : `<span class="pill bad">${code}</span>`;
const siteState = { cat: 'todos', q: '', sel: new Set() };

async function sites() {
  const all = await api('sites.list');
  const cats = ['todos', ...new Set(all.map(s => s.category || 'sem-nota'))];
  const render = () => {
    const q = siteState.q.toLowerCase();
    const list = all.filter(s => (siteState.cat === 'todos' || (s.category || 'sem-nota') === siteState.cat)
      && (!q || [s.name, s.client, s.vercel_url, s.official_url, s.vercel_project].some(v => (v || '').toLowerCase().includes(q))));
    $('#siteList').innerHTML = list.length ? list.map(s => `
      <article class="card site" data-id="${s.id}">
        <div class="row between"><label class="pick"><input type="checkbox" data-pick ${siteState.sel.has(s.id) ? 'checked' : ''}><h3>${esc(s.name)}</h3></label><span class="pill">${esc(CAT_LABEL[s.category] || s.category || 'Sem nota')}</span></div>
        ${s.client ? `<span class="muted">${esc(s.client)}</span>` : ''}
        <div class="links">
          ${s.official_url ? `<div>Oficial: <a href="${esc(s.official_url)}" target="_blank" rel="noopener noreferrer">${esc(s.official_url.replace(/^https?:\/\//, ''))}</a> ${httpPill(s.http_official)}</div>` : ''}
          ${s.vercel_url ? `<div>Vercel: <a href="${esc(s.vercel_url)}" target="_blank" rel="noopener noreferrer">${esc(s.vercel_url.replace(/^https?:\/\//, ''))}</a> ${httpPill(s.http_vercel)}${s.vercel_state && s.vercel_state !== 'READY' ? ` <span class="pill bad" title="estado do último deploy de produção">${esc(s.vercel_state)}</span>` : ''}</div>` : ''}
          ${s.reference_url ? `<div class="muted">Site original do cliente: <a href="${esc(s.reference_url)}" target="_blank" rel="noopener noreferrer">${esc(s.reference_url.replace(/^https?:\/\//, ''))}</a></div>` : ''}
        </div>
        ${s.notes ? `<p class="muted" style="margin:0;font-size:.82rem">${esc(s.notes)}</p>` : ''}
        <div class="row between">
          ${s.project ? `<span class="pill ok">no portfólio: ${esc(s.project.slug)}${s.project.visible ? '' : ' (oculto)'}</span>` : '<button class="btn sm" data-to-project>→ Portfólio</button>'}
          <button class="btn sm danger" data-del-site>Excluir</button>
        </div>
      </article>`).join('') : '<p class="empty">Nenhum site com esse filtro.</p>';
    $('#siteCount').textContent = `${list.length} de ${all.length}`;
    siteState.visible = list.map(x => x.id);
    $('#siteList [data-pick]').forEach(cb => cb.onchange = () => { const id = cb.closest('.site').dataset.id; cb.checked ? siteState.sel.add(id) : siteState.sel.delete(id); bulkBar(); });
    $('#siteList .site').forEach(card => card.classList.toggle('picked', siteState.sel.has(card.dataset.id)));
    bulkBar();
    $$('#siteList [data-del-site]').forEach(b => b.onclick = async () => {
      const s = all.find(x => x.id === b.closest('.site').dataset.id);
      if (!confirm(`Excluir "${s.name}" da lista?\n\nSó sai do hub — o site e o projeto na Vercel não são tocados.`)) return;
      try { await api('sites.delete', { id: s.id }); all.splice(all.indexOf(s), 1); siteState.sel.delete(s.id); toast('Excluído da lista'); render(); } catch (e) { toast(e.message, true); }
    });
    $$('#siteList [data-to-project]').forEach(b => b.onclick = async () => {
      const s = all.find(x => x.id === b.closest('.site').dataset.id);
      try { const d = await api('sites.to_project', { id: s.id }); s.project = { slug: d.project.slug, visible: false }; toast(`Projeto "${d.project.slug}" criado oculto — complete capa e textos em Projetos`); render(); } catch (e) { toast(e.message, true); }
    });
  };
  const bulkBar = () => {
    const n = siteState.sel.size, bar = $('#bulk');
    bar.hidden = false;
    $('#bulkCount').textContent = n ? `${n} selecionado${n > 1 ? 's' : ''}` : 'Nenhum selecionado';
    $('#bulkPortfolio').disabled = $('#bulkDelete').disabled = $('#bulkClear').disabled = !n;
    $('#bulkPortfolio').textContent = `→ Portfólio${n ? ` (${n})` : ''}`;
    $('#bulkDelete').textContent = `Excluir${n ? ` (${n})` : ''}`;
    $('#siteList .site').forEach(card => card.classList.toggle('picked', siteState.sel.has(card.dataset.id)));
  };
  $('#view').innerHTML = `
    <div class="row between"><h2>Sites desenvolvidos</h2><span class="muted" id="siteCount"></span></div>
    <p class="muted">Tudo que eu fiz, num lugar só. "→ Portfólio" cria um projeto oculto com os links; "Excluir" tira só desta lista.</p>
    <div class="filters">${cats.map(c => `<button class="chip ${c === siteState.cat ? 'active' : ''}" data-cat="${esc(c)}">${esc(c === 'todos' ? 'Todos' : CAT_LABEL[c] || c)} (${c === 'todos' ? all.length : all.filter(s => (s.category || 'sem-nota') === c).length})</button>`).join('')}</div>
    <input id="siteSearch" placeholder="Buscar por nome, cliente ou link" value="${esc(siteState.q)}">
    <div class="bulk card" id="bulk" hidden>
      <div class="row"><span id="bulkCount"></span><button class="btn sm ghost" id="bulkAll">Selecionar os filtrados</button><button class="btn sm ghost" id="bulkClear">Limpar</button></div>
      <div class="row"><button class="btn sm" id="bulkPortfolio">→ Portfólio</button><button class="btn sm danger" id="bulkDelete">Excluir</button></div>
    </div>
    <div class="sites-grid" id="siteList"></div>`;
  $('#bulkAll').onclick = () => { siteState.visible.forEach(id => siteState.sel.add(id)); render(); };
  $('#bulkClear').onclick = () => { siteState.sel.clear(); render(); };
  $('#bulkDelete').onclick = async () => {
    const ids = [...siteState.sel]; const names = all.filter(x => ids.includes(x.id)).map(x => '• ' + x.name);
    const more = names.length > 15 ? `\n… e mais ${names.length - 15}` : '';
    if (!confirm(`Excluir ${ids.length} site(s) da lista?\n\n${names.slice(0, 15).join('\n')}${more}\n\nSó sai do hub — sites e projetos na Vercel não são tocados.`)) return;
    try { const d = await api('sites.delete_many', { ids }); for (const id of ids) { const i = all.findIndex(x => x.id === id); if (i >= 0) all.splice(i, 1); } siteState.sel.clear(); toast(`${d.deleted} excluído(s) da lista`); render(); } catch (e) { toast(e.message, true); }
  };
  $('#bulkPortfolio').onclick = async () => {
    const ids = [...siteState.sel].filter(id => !all.find(x => x.id === id)?.project);
    if (!ids.length) { toast('Os selecionados já estão no portfólio'); return; }
    if (!confirm(`Criar ${ids.length} projeto(s) OCULTO(S) no portfólio?\n\nEles só aparecem no site depois que você completar capa/textos em Projetos e ligar o Visível.`)) return;
    try {
      const d = await api('sites.to_project_many', { ids });
      for (const r of d.results) if (r.ok) { const x = all.find(y => y.id === r.id); if (x) x.project = { slug: r.slug, visible: false }; }
      const fails = d.results.filter(r => !r.ok);
      siteState.sel.clear(); toast(`${d.created} projeto(s) criado(s) oculto(s)${fails.length ? ` · ${fails.length} falharam: ${fails[0].error}` : ''}`, !!fails.length); render();
    } catch (e) { toast(e.message, true); }
  };
  $$('.chip').forEach(b => b.onclick = () => { siteState.cat = b.dataset.cat; $$('.chip').forEach(x => x.classList.toggle('active', x === b)); render(); });
  $('#siteSearch').oninput = e => { siteState.q = e.target.value; render(); };
  render();
}

// ── Jobs & Financeiro ─────────────────────────────────
const JOB_TYPES = ['site', 'identidade', 'campanha', '3d', 'outro'];
const JOB_STATUS = ['proposta', 'em_andamento', 'entregue', 'cancelado'];
const opt = (arr, cur) => arr.map(v => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(v.replace('_', ' '))}</option>`).join('');

async function finance() {
  const [clients, jobs, payments, expenses, ps] = await Promise.all([api('clients.list'), api('jobs.list'), api('payments.list'), api('expenses.list'), api('projects.list')]);
  const today = new Date().toISOString().slice(0, 10);
  const payPill = p => p.status === 'pago' ? '<span class="pill ok">pago</span>' : p.status === 'cancelado' ? '<span class="pill">cancelado</span>' : (p.due_date && p.due_date < today ? '<span class="pill bad">atrasado</span>' : '<span class="pill warn">pendente</span>');
  $('#view').innerHTML = `
    <h2>Jobs &amp; Financeiro</h2>
    <div class="grid2">
      <form class="card form-grid" id="jobForm"><h3>Novo job</h3>
        <label>Título<input name="title" required></label>
        <div class="form-grid two">
          <label>Cliente<select name="client_id"><option value="">—</option>${clients.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
          <label>Projeto público (opcional)<select name="project_id"><option value="">—</option>${ps.map(p => `<option value="${p.id}">${esc(p.slug)}</option>`).join('')}</select></label>
          <label>Tipo<select name="type">${opt(JOB_TYPES, 'outro')}</select></label>
          <label>Status<select name="status">${opt(JOB_STATUS, 'proposta')}</select></label>
          <label>Início<input name="started_at" type="date"></label><label>Entrega<input name="delivered_at" type="date"></label>
        </div>
        <label>Notas<textarea name="notes"></textarea></label><button class="btn primary">Criar job</button>
      </form>
      <div class="form-grid">
        <form class="card form-grid" id="clientForm"><h3>Novo cliente</h3><div class="form-grid two"><label>Nome<input name="name" required></label><label>Contato<input name="contact"></label></div><button class="btn">Criar cliente</button></form>
        <form class="card form-grid" id="payForm"><h3>Lançar pagamento</h3>
          <label>Job<select name="job_id" required><option value="">—</option>${jobs.map(j => `<option value="${j.id}">${esc(j.title)}${j.client ? ' · ' + esc(j.client.name) : ''}</option>`).join('')}</select></label>
          <div class="form-grid two"><label>Valor (R$)<input name="amount" inputmode="decimal" placeholder="1.500,00" required></label><label>Moeda<input name="currency" value="BRL" maxlength="3"></label>
          <label>Vencimento<input name="due_date" type="date"></label><label>Pago em<input name="paid_at" type="date"></label></div>
          <label class="row"><input type="checkbox" name="nf_emitida" style="width:auto"> NF emitida</label><button class="btn primary">Lançar</button>
        </form>
      </div>
    </div>
    <div class="card table-wrap"><h3>Jobs (${jobs.length})</h3>${jobs.length ? `<table><thead><tr><th>Job</th><th>Cliente</th><th>Tipo</th><th>Status</th><th>Projeto</th><th></th></tr></thead><tbody>${jobs.map(j => `
      <tr data-id="${j.id}"><td>${esc(j.title)}</td><td>${esc(j.client?.name || '—')}</td><td>${esc(j.type)}</td>
      <td><select data-job-status>${opt(JOB_STATUS, j.status)}</select></td><td>${esc(j.project?.slug || '—')}</td><td><button class="btn sm danger" data-del-job>Apagar</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nenhum job.</p>'}</div>
    <div class="card table-wrap"><h3>Pagamentos (${payments.length})</h3>${payments.length ? `<table><thead><tr><th>Job</th><th>Valor</th><th>Vencimento</th><th>Pago em</th><th>Status</th><th>NF</th><th></th></tr></thead><tbody>${payments.map(p => `
      <tr data-id="${p.id}"><td>${esc(p.job?.title || '—')}</td><td>${brl(p.amount_cents, p.currency)}</td><td>${esc(p.due_date || '—')}</td><td>${esc(p.paid_at || '—')}</td><td>${payPill(p)}</td><td>${p.nf_emitida ? 'sim' : 'não'}</td>
      <td class="row">${p.status !== 'pago' ? '<button class="btn sm" data-pay>Marcar pago</button>' : ''}<button class="btn sm danger" data-del-pay>Apagar</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nenhum pagamento.</p>'}</div>
    <div class="grid2">
      <form class="card form-grid" id="expForm"><h3>Nova despesa (PJ)</h3><div class="form-grid two"><label>Categoria<input name="category" placeholder="contador, ferramenta…" required></label><label>Valor (R$)<input name="amount" inputmode="decimal" required></label><label>Data<input name="date" type="date" value="${today}" required></label><label class="row"><input type="checkbox" name="recorrente" style="width:auto"> Recorrente</label></div><button class="btn">Lançar despesa</button></form>
      <div class="card table-wrap"><h3>Despesas (${expenses.length})</h3>${expenses.length ? `<table><tbody>${expenses.map(x => `<tr data-id="${x.id}"><td>${esc(x.date)}</td><td>${esc(x.category)}${x.recorrente ? ' <span class="pill">recorrente</span>' : ''}</td><td>${brl(x.amount_cents, x.currency)}</td><td><button class="btn sm danger" data-del-exp>Apagar</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nenhuma despesa.</p>'}</div>
    </div>`;

  const form = (id, fn) => $(id).addEventListener('submit', async e => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target));
    try { await fn(fd, e.target); toast('Salvo'); finance(); } catch (err) { toast(err.message, true); }
  });
  const nul = v => (v === '' || v === undefined ? null : v);
  form('#jobForm', fd => api('jobs.create', { job: { title: fd.title, client_id: nul(fd.client_id), project_id: nul(fd.project_id), type: fd.type, status: fd.status, started_at: nul(fd.started_at), delivered_at: nul(fd.delivered_at), notes: nul(fd.notes) } }));
  form('#clientForm', fd => api('clients.create', { client: { name: fd.name, contact: nul(fd.contact) } }));
  form('#payForm', (fd, f) => api('payments.create', { payment: { job_id: fd.job_id, amount_cents: toCents(fd.amount), currency: (fd.currency || 'BRL').toUpperCase(), due_date: nul(fd.due_date), paid_at: nul(fd.paid_at), status: fd.paid_at ? 'pago' : 'pendente', nf_emitida: f.nf_emitida.checked } }));
  form('#expForm', (fd, f) => api('expenses.create', { expense: { category: fd.category, amount_cents: toCents(fd.amount), date: fd.date, recorrente: f.recorrente.checked } }));
  const rowAct = (sel, fn) => $$(sel).forEach(b => b.addEventListener(b.tagName === 'SELECT' ? 'change' : 'click', async () => {
    try { await fn(b.closest('tr').dataset.id, b); toast('Atualizado'); finance(); } catch (err) { toast(err.message, true); }
  }));
  rowAct('[data-job-status]', (id, s) => api('jobs.update', { id, patch: { status: s.value } }));
  rowAct('[data-del-job]', id => confirm('Apagar job e seus pagamentos?') ? api('jobs.delete', { id }) : Promise.reject(new Error('cancelado')));
  rowAct('[data-pay]', id => api('payments.update', { id, patch: { status: 'pago', paid_at: today } }));
  rowAct('[data-del-pay]', id => confirm('Apagar pagamento?') ? api('payments.delete', { id }) : Promise.reject(new Error('cancelado')));
  rowAct('[data-del-exp]', id => confirm('Apagar despesa?') ? api('expenses.delete', { id }) : Promise.reject(new Error('cancelado')));
}

// ── Assets ────────────────────────────────────────────
async function assets(q = '') {
  const [items, ps] = await Promise.all([api('assets.list', { q }), api('projects.list')]);
  $('#view').innerHTML = `
    <h2>Assets</h2>
    <form class="card form-grid" id="upForm"><h3>Enviar material</h3>
      <div class="form-grid two"><label>Arquivo<input type="file" name="file" required></label><label>Título<input name="title"></label>
      <label>Tipo<select name="kind">${opt(['logo', 'mockup', 'fonte', 'paleta', 'template', 'outro'], 'outro')}</select></label>
      <label>Tags <span class="muted">(vírgula)</span><input name="tags"></label>
      <label>Projeto<select name="project_id"><option value="">—</option>${ps.map(p => `<option value="${p.id}">${esc(p.slug)}</option>`).join('')}</select></label>
      <label>Bucket<select name="bucket"><option value="private-assets">privado (só eu)</option><option value="public-media">público</option></select></label></div>
      <button class="btn primary">Enviar</button>
    </form>
    <form class="row" id="search"><input name="q" placeholder="Buscar por título ou tag" value="${esc(q)}" style="flex:1"><button class="btn">Buscar</button></form>
    <div class="card table-wrap">${items.length ? `<table><thead><tr><th>Título</th><th>Tipo</th><th>Tags</th><th>Projeto</th><th>Bucket</th><th></th></tr></thead><tbody>${items.map(a => `
      <tr data-id="${a.id}"><td>${esc(a.title || a.storage_path)}</td><td>${esc(a.kind)}</td><td>${(a.tags || []).map(t => `<span class="pill">${esc(t)}</span>`).join(' ')}</td><td>${esc(a.project?.slug || '—')}</td><td>${a.bucket === 'public-media' ? 'público' : 'privado'}</td>
      <td class="row"><button class="btn sm" data-open>Abrir</button><button class="btn sm danger" data-del>Apagar</button></td></tr>`).join('')}</tbody></table>` : '<p class="empty">Nenhum asset.</p>'}</div>`;

  $('#search').onsubmit = e => { e.preventDefault(); assets(new FormData(e.target).get('q').trim()); };
  $('#upForm').onsubmit = async e => {
    e.preventDefault(); const fd = new FormData(e.target); const file = fd.get('file');
    try {
      const s = await api('upload.sign', { bucket: fd.get('bucket'), path: `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${file.name}` });
      const r = await fetch(s.upload_url, { method: 'PUT', headers: { 'content-type': file.type || 'application/octet-stream' }, body: file });
      if (!r.ok) throw new Error('upload falhou: ' + r.status);
      await api('assets.create', { asset: { bucket: s.bucket, storage_path: s.path, title: fd.get('title') || file.name, kind: fd.get('kind'), tags: list(fd.get('tags')), project_id: fd.get('project_id') || null, mime: file.type, size_bytes: file.size } });
      toast('Enviado'); assets(q);
    } catch (err) { toast(err.message, true); }
  };
  $$('[data-open]').forEach(b => b.onclick = async () => { try { window.open((await api('assets.url', { id: b.closest('tr').dataset.id })).url, '_blank', 'noopener'); } catch (err) { toast(err.message, true); } });
  $$('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Apagar asset e arquivo?')) return; try { await api('assets.delete', { id: b.closest('tr').dataset.id }); toast('Apagado'); assets(q); } catch (err) { toast(err.message, true); } });
}

// ── Boot ──────────────────────────────────────────────
sb.auth.getSession().then(({ data: { session } }) => (session ? showApp() : showLogin()));
sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_OUT' || !session) showLogin(); });
