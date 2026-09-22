-- Seção "Sites desenvolvidos" da home passa a sair da tabela `sites`.
alter table public.sites
  add column show_home boolean not null default false,
  add column home_order integer,
  add column home_label text,                 -- texto do card (ex.: "E-commerce — Shopify")
  add column home_shot text;                  -- base da URL do print; o site usa <base>-480/-720/-960.webp

-- Leitura pública SÓ do necessário para o card, SÓ dos sites marcados para a home.
-- A tabela `sites` continua fechada (RLS só dono); a view expõe 5 colunas.
create view public.home_sites as
  select id, name, home_label as label, coalesce(official_url, vercel_url) as url, home_shot as shot, home_order as sort
  from public.sites
  where show_home and coalesce(official_url, vercel_url) is not null;
revoke all on public.home_sites from anon, authenticated;
grant select on public.home_sites to anon, authenticated;
