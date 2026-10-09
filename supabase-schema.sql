-- ============================================================
-- Bordados Berny — Supabase Schema v1.0
-- Paste this entire file into the Supabase SQL Editor and run.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────────────────────
-- uuid_generate_v4() is available by default on Supabase; pg_trgm for search.
create extension if not exists "pg_trgm";

-- ── Enum: order status ────────────────────────────────────────────────────────
-- Matches the Kanban columns exactly.
create type order_status as enum (
  'Recibido',
  'En Revision',
  'En Produccion',
  'Control Calidad',
  'Listo',
  'Entregado',
  'Cancelado'
);

-- ── Enum: garment type ────────────────────────────────────────────────────────
create type garment_type as enum (
  'pantalon',
  'short',
  'blusa',
  'polera',
  'poleron',
  'otro',
  'bordado'
);

-- ── Enum: embroidery mode ─────────────────────────────────────────────────────
create type embroidery_mode as enum ('image', 'text');

-- ── Enum: embroidery size ─────────────────────────────────────────────────────
create type embroidery_size as enum ('10x10', '13x18', '18x26');

-- ── Enum: user role ───────────────────────────────────────────────────────────
create type user_role as enum ('customer', 'admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: profiles
-- One row per Supabase Auth user. Created automatically by trigger (below).
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid        primary key references auth.users (id) on delete cascade,
  role        user_role   not null default 'customer',
  full_name   text,
  avatar_url  text,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Extended user data. Linked 1-to-1 with auth.users via trigger.';

-- Auto-create profile on new signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: orders
-- One row per customer wizard submission.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.orders (
  id                  uuid          primary key default gen_random_uuid(),
  customer_id         uuid          not null references public.profiles (id) on delete restrict,

  -- Wizard Step 1: garment
  garment_type        garment_type  not null,

  -- Wizard Step 2: photos (Supabase Storage public URLs)
  photo_front_url     text,
  photo_back_url      text,
  photo_detail_url    text,

  -- Wizard Step 3: description
  description         text          not null check (char_length(description) >= 10),

  -- Embroidery-specific (null when garment_type != 'bordado')
  embroidery_mode     embroidery_mode,
  embroidery_size     embroidery_size,
  embroidery_text     text,                   -- only when mode = 'text'
  font_style          text,                   -- 'script' | 'serif' | 'sans'
  scheduled_date      date,
  scheduled_time      time,

  -- Pricing
  total_price         integer       not null default 0 check (total_price >= 0),
                                              -- stored in CLP (integer, no cents)
  has_text_discount   boolean       not null default false,

  -- Workflow
  status              order_status  not null default 'Recibido',
  internal_note       text,                   -- admin-only notes
  assigned_to         uuid          references public.profiles (id) on delete set null,

  -- Payment
  payment_status      text          not null default 'pending'
                                    check (payment_status in ('pending','paid','refunded','failed')),
  payment_provider    text,                   -- 'mercadopago'
  payment_reference   text,                   -- MP preference_id or payment_id

  -- Timestamps
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

comment on table public.orders is
  'One order per wizard submission. Source of truth for the Kanban board.';

create trigger orders_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- Index: fast lookups by customer and status (Kanban query)
create index orders_customer_id_idx on public.orders (customer_id);
create index orders_status_idx      on public.orders (status);
create index orders_created_at_idx  on public.orders (created_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: order_status_history
-- Immutable audit log; one row per status transition.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.order_status_history (
  id          uuid          primary key default gen_random_uuid(),
  order_id    uuid          not null references public.orders (id) on delete cascade,
  from_status order_status,
  to_status   order_status  not null,
  changed_by  uuid          references public.profiles (id) on delete set null,
  note        text,
  created_at  timestamptz   not null default now()
);

create index order_status_history_order_id_idx on public.order_status_history (order_id);

-- Auto-insert history row on every status change
create or replace function public.log_order_status_change()
returns trigger language plpgsql security definer as $$
begin
  if old.status is distinct from new.status then
    insert into public.order_status_history (order_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger orders_status_change
  after update on public.orders
  for each row execute procedure public.log_order_status_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: is_admin()
-- Used in every RLS policy. Reads role from profiles — no JWT claim required
-- (avoids having to set custom claims via a hook in the free tier).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles             enable row level security;
alter table public.orders               enable row level security;
alter table public.order_status_history enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────────

-- Users can read and update only their own profile
create policy "profiles: self read"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

create policy "profiles: self update"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    -- customers cannot promote themselves to admin
    role = (select role from public.profiles where id = auth.uid())
    or public.is_admin()
  );

-- Admins can do full CRUD on profiles
create policy "profiles: admin insert"
  on public.profiles for insert
  with check (public.is_admin());

create policy "profiles: admin delete"
  on public.profiles for delete
  using (public.is_admin());

-- ── orders ────────────────────────────────────────────────────────────────────

-- Customers: insert their own orders; read their own orders
create policy "orders: customer insert"
  on public.orders for insert
  with check (customer_id = auth.uid());

create policy "orders: customer read"
  on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());

-- Customers can update only description/photos before status moves beyond 'Recibido'
create policy "orders: customer update own pending"
  on public.orders for update
  using (customer_id = auth.uid() and status = 'Recibido')
  with check (customer_id = auth.uid());

-- Admins: full CRUD
create policy "orders: admin all"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- ── order_status_history ──────────────────────────────────────────────────────

create policy "history: customer read own"
  on public.order_status_history for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "history: admin all"
  on public.order_status_history for all
  using (public.is_admin())
  with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- STORAGE: design-uploads bucket
-- Run this after enabling Storage in the Supabase dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('design-uploads', 'design-uploads', false)
on conflict do nothing;

-- Customers upload to their own folder; admins read everything
create policy "storage: customer upload own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'design-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: customer read own"
  on storage.objects for select
  using (
    bucket_id = 'design-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage: admin all"
  on storage.objects for all
  using (bucket_id = 'design-uploads' and public.is_admin())
  with check (bucket_id = 'design-uploads' and public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED: create your first admin user
-- After signing up via the app, run this once with the user's UUID:
--   update public.profiles set role = 'admin' where id = '<your-uuid>';
-- ─────────────────────────────────────────────────────────────────────────────
