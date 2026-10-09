-- Inventario migration — tabla nueva para /admin/inventory
--
-- No existía ninguna tabla de inventario en el esquema original. Esta
-- migración es puramente additiva: no toca `orders`, `profiles` ni ninguna
-- política existente.
--
-- Mismo patrón de RLS que `orders` (admin-only vía is_admin(), ya definida
-- en supabase-schema.sql — no se vuelve a crear acá).
--
-- Pega este archivo completo en el SQL Editor de Supabase y ejecútalo.

create table if not exists public.inventory_items (
  id                  uuid          primary key default gen_random_uuid(),
  name                text          not null check (char_length(name) >= 1),
  category            text,
  quantity            integer       not null default 0 check (quantity >= 0),
  unit                text          not null default 'unidad',
  low_stock_threshold integer       not null default 0 check (low_stock_threshold >= 0),
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

comment on table public.inventory_items is
  'Insumos/materiales del taller (hilos, telas, etc.) para /admin/inventory.';

-- Reusa el trigger genérico set_updated_at() ya creado en supabase-schema.sql
create trigger inventory_items_updated_at
  before update on public.inventory_items
  for each row execute procedure public.set_updated_at();

create index if not exists inventory_items_name_idx on public.inventory_items (name);

-- ── RLS: admin-only (mismo patrón que `orders: admin all`) ───────────────────
alter table public.inventory_items enable row level security;

create policy "inventory_items: admin all"
  on public.inventory_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- Nota: esta tabla es admin-only de punta a punta — los clientes nunca la
-- leen ni la escriben, así que no hace falta ninguna política adicional
-- para `role = 'customer'`.
