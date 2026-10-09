-- Matrices Digitales (.pes) migration — Ronda 4
--
-- Closes the two real gaps in the digitizing flow:
--
-- 1. `design_image_urls` — the wizard's "Digitalizar Imagen" mode has
--    always let the customer attach reference images (components/
--    embroidery-wizard.tsx `designImages`), but they only ever lived as
--    base64 in React state — never uploaded, never seen by Bernardita.
--    She was digitizing blind, with no reference image at all.
--
-- 2. `pes_file_url` — there was nowhere for Bernardita to upload the
--    finished .pes/.dst file. EmailSendModal only ever faked "sending" it
--    (see email-send-modal.tsx). Now she uploads it once from the Kanban,
--    and the customer can download it for real from /tracker — WhatsApp
--    is still used to *notify* her it's ready (per Ignacio), but the file
--    itself no longer depends on being attached by hand in a chat.
--
-- Safe to run on the live table: purely additive, existing rows get NULL.

alter table public.orders
  add column if not exists design_image_urls text[],
  add column if not exists pes_file_url text;

-- No new RLS policy needed: `design_image_urls` is written by the
-- customer at order-creation time (already covered by "orders: customer
-- insert"); `pes_file_url` is written only by Bernardita from the admin
-- Kanban (already covered by "orders: admin all"). Both are read by the
-- customer via the existing "orders: customer read" policy.
