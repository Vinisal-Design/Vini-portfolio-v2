-- Catálogo de todos os sites desenvolvidos (privado): base para decidir o que entra no portfólio.
create table public.sites (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,                 -- identificador estável (projeto Vercel ou domínio oficial)
  name text not null,
  client text,
  category text,                            -- freelance · cliente · a-formula · lab · pessoal · sem-nota
  platform text,                            -- vercel · shopify · nuvemshop · outro
  vercel_project text,
  vercel_url text,
  official_url text,                        -- site no ar feito por mim
  reference_url text,                       -- site original do cliente (base de um redesign)
  vercel_state text,                        -- estado do deploy de produção na Vercel (READY, BLOCKED…)
  http_vercel integer,                      -- status HTTP medido
  http_official integer,
  checked_at timestamptz,
  source_note text,                         -- nota do Second Brain de onde veio o dado
  source_status text,                       -- status declarado na nota (ex.: prospecting)
  notes text,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sites_updated_at before update on public.sites
  for each row execute function public.touch_updated_at();

alter table public.sites enable row level security;
create policy "dono gerencia sites" on public.sites
  for all to authenticated using (public.is_owner()) with check (public.is_owner());
revoke all on public.sites from anon;
