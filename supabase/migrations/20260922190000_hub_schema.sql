-- Hub pessoal: schema, RLS (default negar), storage e trava de usuário único.
-- Dono único: viniciusal60@gmail.com. Dinheiro sempre em centavos (integer).

-- ── Dono ──────────────────────────────────────────────
create or replace function public.is_owner()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and lower(coalesce(auth.jwt() ->> 'email', '')) = 'viniciusal60@gmail.com'
$$;

-- Nenhum outro usuário nasce no auth, nem por API admin nem por signup.
create or replace function public.guard_single_user()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if lower(coalesce(new.email, '')) <> 'viniciusal60@gmail.com' then
    raise exception 'usuario nao permitido';
  end if;
  return new;
end;
$$;

create trigger guard_single_user
  before insert or update of email on auth.users
  for each row execute function public.guard_single_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Tipos ─────────────────────────────────────────────
create type public.job_type as enum ('site', 'identidade', 'campanha', '3d', 'outro');
create type public.job_status as enum ('proposta', 'em_andamento', 'entregue', 'cancelado');
create type public.payment_status as enum ('pendente', 'pago', 'cancelado');
create type public.asset_kind as enum ('logo', 'mockup', 'fonte', 'paleta', 'template', 'outro');

-- ── Projetos (portfólio público) ──────────────────────
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  subtitle text,
  category text,
  year text,
  client text,
  role text,
  thumbnail_url text,
  cover_alt text,
  gallery_urls text[] not null default '{}',
  video_urls text[] not null default '{}',
  tags text[] not null default '{}',
  stack text[] not null default '{}',
  url_official text,
  url_vercel text,
  url_repo text,
  -- card da home (o markup da home diverge do JSON: título, descrição, tags, categoria, ano, alt, parallax)
  home_title text,
  home_desc text,
  home_tags text[] not null default '{}',
  home_category text,
  home_year text,
  home_alt text,
  home_parallax numeric(4, 2),
  visible boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_public_order on public.projects (visible, sort_order);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.touch_updated_at();

-- ── Financeiro e jobs ─────────────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete restrict,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  type public.job_type not null default 'outro',
  status public.job_status not null default 'proposta',
  started_at date,
  delivered_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger jobs_updated_at before update on public.jobs
  for each row execute function public.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  due_date date,
  paid_at date,
  status public.payment_status not null default 'pendente',
  nf_emitida boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index payments_job on public.payments (job_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount_cents integer not null check (amount_cents >= 0),
  currency char(3) not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  date date not null,
  recorrente boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'private-assets' check (bucket in ('public-media', 'private-assets')),
  storage_path text not null,
  title text,
  kind public.asset_kind not null default 'outro',
  tags text[] not null default '{}',
  project_id uuid references public.projects (id) on delete set null,
  mime text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  unique (bucket, storage_path)
);

-- ── RLS: ligado em todas; sem policy = negado ─────────
alter table public.projects enable row level security;
alter table public.clients  enable row level security;
alter table public.jobs     enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.assets   enable row level security;

create policy "publico le projetos visiveis" on public.projects
  for select to anon, authenticated using (visible = true);
create policy "dono gerencia projetos" on public.projects
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "dono gerencia clients"  on public.clients  for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "dono gerencia jobs"     on public.jobs     for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "dono gerencia payments" on public.payments for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "dono gerencia expenses" on public.expenses for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "dono gerencia assets"   on public.assets   for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- Defesa em profundidade: anon nem tem privilégio nas tabelas privadas.
revoke all on public.clients, public.jobs, public.payments, public.expenses, public.assets from anon;
revoke insert, update, delete, truncate on public.projects from anon;

-- ── Storage ───────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('public-media', 'public-media', true), ('private-assets', 'private-assets', false)
on conflict (id) do nothing;

create policy "dono escreve public-media" on storage.objects
  for insert to authenticated with check (bucket_id = 'public-media' and public.is_owner());
create policy "dono altera public-media" on storage.objects
  for update to authenticated using (bucket_id = 'public-media' and public.is_owner());
create policy "dono apaga public-media" on storage.objects
  for delete to authenticated using (bucket_id = 'public-media' and public.is_owner());
create policy "dono gerencia private-assets" on storage.objects
  for all to authenticated
  using (bucket_id = 'private-assets' and public.is_owner())
  with check (bucket_id = 'private-assets' and public.is_owner());
