-- Kanban persistence migration
--
-- The production pipeline (Esperando Recepción → Agenda Taller → En
-- Ejecución → Terminado) is a DIFFERENT state machine from the
-- customer-facing order status shown in /tracker (Recibido, En Revision,
-- En Produccion, Control Calidad, Listo, Entregado, Cancelado). They track
-- different things — one is Bernardita's internal workshop-floor view, the
-- other is what the customer sees — so this adds its own column instead of
-- overloading `orders.status`, which a live RLS policy already checks
-- against the exact string 'Recibido'. Keeping them separate means this
-- migration can't break that policy or the customer tracker.
--
-- Safe to run on the live table: purely additive, existing rows get the
-- default stage.

alter table public.orders
  add column if not exists kanban_stage text not null default 'waiting_reception';

alter table public.orders
  drop constraint if exists orders_kanban_stage_check;

alter table public.orders
  add constraint orders_kanban_stage_check
  check (kanban_stage in ('waiting_reception', 'scheduled_today', 'in_progress', 'completed'));

-- No new RLS policy needed: admins already have full CRUD on `orders` via
-- the existing is_admin() policy, and this column is never read or written
-- by the customer-facing pages.
