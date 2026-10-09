-- Fulfillment data migration (Ronda 3 — cablear modales del Kanban)
--
-- Three real gaps found while wiring CompletionModal / ShippingLabelModal /
-- EmailSendModal to Supabase instead of setTimeout() simulations:
--
-- 1. `delivery_option` / `delivery_address` — PaymentModal has always asked
--    the customer to pick "Retiro en Taller" vs "Despacho a Domicilio" and
--    type an address, but nothing ever saved that choice. ShippingLabelModal
--    was showing a hardcoded fake address to admins for every single order.
--
-- 2. `completion_photo_url` — CompletionModal let the admin drag in a photo
--    of the finished garment, but only ever kept it as in-memory base64 in
--    React state; it was never uploaded anywhere, so it vanished on refresh.
--
-- 3. `pes_notified_at` — tracks whether Bernardita has told the customer
--    their .pes file is ready (see email-send-modal.tsx: this app has no
--    email provider configured yet, so "EmailSendModal" now notifies over
--    WhatsApp — the channel already used everywhere else in this app —
--    instead of silently pretending to send an email that was never sent).
--
-- Safe to run on the live table: purely additive, existing rows get NULL /
-- the stated defaults.

alter table public.orders
  add column if not exists delivery_option text,
  add column if not exists delivery_address text,
  add column if not exists completion_photo_url text,
  add column if not exists pes_notified_at timestamptz;

alter table public.orders
  drop constraint if exists orders_delivery_option_check;

alter table public.orders
  add constraint orders_delivery_option_check
  check (delivery_option is null or delivery_option in ('pickup', 'delivery'));

-- No new RLS policy needed: these are plain columns on `orders`, already
-- covered by the existing customer/admin policies on that table.
