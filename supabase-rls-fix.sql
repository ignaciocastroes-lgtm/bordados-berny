-- ============================================================
-- Bordados Berny — RLS fix / verificación exacta para "orders"
-- Ejecutar completo en el SQL Editor de Supabase.
--
-- NOTA: la tabla se llama "orders", no "tickets". Si tu código
-- usa supabase.from('tickets'), es un typo — corrígelo a 'orders'
-- (así se llama en supabase-schema.sql y en toda la app).
-- ============================================================

-- Asegura que RLS está activo (no-op si ya lo estaba)
alter table public.orders enable row level security;

-- ── Limpieza: elimina políticas previas con el mismo nombre ──────────────────
-- (permite volver a correr este script sin errores de "already exists")
drop policy if exists "orders: customer insert"          on public.orders;
drop policy if exists "orders: customer read"             on public.orders;
drop policy if exists "orders: customer update own pending" on public.orders;
drop policy if exists "orders: admin all"                 on public.orders;

-- ── 1. Cliente autenticado puede INSERTAR solo pedidos propios ───────────────
-- El customer_id del row insertado DEBE ser su propio auth.uid().
create policy "orders: customer insert"
  on public.orders for insert
  to authenticated
  with check (customer_id = auth.uid());

-- ── 2. Cliente autenticado puede LEER solo sus propios pedidos ───────────────
create policy "orders: customer read"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid());

-- ── 3. Cliente puede editar su propio pedido solo mientras sigue "Recibido" ──
create policy "orders: customer update own pending"
  on public.orders for update
  to authenticated
  using (customer_id = auth.uid() and status = 'Recibido')
  with check (customer_id = auth.uid());

-- ── 4. Admin: acceso total (SELECT + INSERT + UPDATE + DELETE) ───────────────
-- is_admin() ya existe en supabase-schema.sql — lee profiles.role = 'admin'.
create policy "orders: admin all"
  on public.orders for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- Verificación rápida — ejecuta esto para confirmar que las
-- políticas quedaron activas:
-- ============================================================
-- select policyname, cmd, roles
-- from pg_policies
-- where tablename = 'orders';
