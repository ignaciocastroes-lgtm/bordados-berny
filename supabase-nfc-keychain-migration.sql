-- Llaveros NFC — producto nuevo (Ronda 10)
--
-- Hoy "Llaveros y etiquetas NFC" es el producto estrella de la web pública
-- (bordadosberny.vercel.app) pero solo se cotiza por WhatsApp — no existe
-- en la WebApp. Esta migración agrega:
--
--   FASE 1 — pedido del llavero en el wizard (igual que cualquier prenda,
--   pero con caso de uso + contenido NFC + cantidad; precio queda en 0,
--   Bernardita cotiza a mano como ya hace con pantalón/short/etc.).
--
--   FASE 2 — tabla `nfc_profiles`: una página pública por llavero vendido
--   (la URL que el chip NFC realmente abre cuando alguien acerca el
--   celular). El cliente llena su propio contenido (nombre de la mascota,
--   redes de su negocio, etc. — el espíritu "hazlo tuyo"), Bernardita la
--   publica desde el admin cuando el llavero ya está listo/entregado.
--
-- Seguro de correr en producción: todo additivo. `ALTER TYPE ... ADD
-- VALUE` no se puede usar en el mismo bloque de transacción en el que se
-- inserta ese valor nuevo — este script solo altera el esquema, no inserta
-- filas, así que no hay conflicto.

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 1 — pedido
-- ─────────────────────────────────────────────────────────────────────────────

alter type public.garment_type add value if not exists 'llavero_nfc';

create type public.nfc_use_case as enum (
  'sos_mochila',
  'club_deportivo',
  'mascota',
  'tarjeta_digital',
  'auto'
);

alter table public.orders
  add column if not exists quantity      integer not null default 1 check (quantity >= 1),
  add column if not exists nfc_use_case  public.nfc_use_case,
  add column if not exists nfc_content   text;

comment on column public.orders.quantity is
  'Cantidad de unidades del pedido. Default 1 para prendas normales (siempre fueron 1 a la vez); los llaveros NFC se piden por lote.';
comment on column public.orders.nfc_use_case is
  'Solo para garment_type = llavero_nfc: qué tipo de info va en el chip (ver público: SOS Mochilas, Clubes, Mascotas, Tarjeta Digital) + "auto" (llavero de vehículo, nuevo).';
comment on column public.orders.nfc_content is
  'Texto libre del cliente: qué quiere que abra el chip. Bernardita lo programa a mano en el tag NFC físico — no dispara nada automático todavía (ver nfc_profiles para la versión que sí publica una página real).';

-- No hace falta RLS nueva: quantity/nfc_use_case/nfc_content son columnas
-- más de `orders`, ya cubiertas por las policies existentes ("orders:
-- customer insert/read/update own pending", "orders: admin all"). El
-- trigger de endurecimiento (orders_enforce_customer_update,
-- supabase-order-update-rls-hardening-migration.sql) tampoco necesita
-- tocarse: esas 3 columnas no están en su lista de "prohibidas para el
-- cliente", así que siguen editables por el cliente mientras el pedido
-- esté en 'Recibido' — igual que description/fotos, a propósito (son su
-- propio input, no algo que solo el admin deba tocar).

-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 2 — página pública que abre el chip
-- ─────────────────────────────────────────────────────────────────────────────

create table public.nfc_profiles (
  id            uuid          primary key default gen_random_uuid(),
  order_id      uuid          not null references public.orders (id) on delete cascade,
  use_case      public.nfc_use_case not null,
  slug          text          not null unique check (char_length(slug) between 4 and 32),
  is_published  boolean       not null default false,
  -- Forma de template_data según use_case (documentado también en
  -- lib/nfc.ts — es la misma fuente de verdad en TS):
  --   mascota:          { pet_name, pet_photo_url, breed, owner_name, owner_phone, note }
  --   auto:             { owner_name, owner_phone, plate, note }
  --   sos_mochila:      { child_name, guardian_name, guardian_phone, allergies_note }
  --   club_deportivo:   { club_name, member_name, member_role, club_logo_url, member_photo_url, contact_phone }
  --   tarjeta_digital:  { business_name, tagline, whatsapp_phone, instagram_url, website_url, catalog_url }
  template_data jsonb         not null default '{}'::jsonb,
  created_at    timestamptz   not null default now(),
  updated_at    timestamptz   not null default now()
);

comment on table public.nfc_profiles is
  'Una fila por llavero NFC vendido — la página real que /nfc/[slug] renderiza cuando alguien acerca el celular al chip. El cliente llena template_data (su propio contenido); is_published lo prende Bernardita desde el admin.';

create trigger nfc_profiles_updated_at
  before update on public.nfc_profiles
  for each row execute procedure public.set_updated_at();

create index nfc_profiles_order_id_idx on public.nfc_profiles (order_id);
create index nfc_profiles_slug_idx     on public.nfc_profiles (slug);

alter table public.nfc_profiles enable row level security;

-- Cualquiera (sin login) puede leer un perfil YA publicado — es la página
-- que abre el chip, nadie escanea un llavero estando autenticado.
create policy "nfc_profiles: public read published"
  on public.nfc_profiles for select
  using (is_published = true);

-- El dueño del pedido puede leer y editar SU propio perfil mientras no esté
-- publicado todavía (una vez publicado, solo el admin lo vuelve a editar —
-- evita que el cliente cambie el contenido por debajo después de aprobado).
create policy "nfc_profiles: owner read own"
  on public.nfc_profiles for select
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
    or public.is_admin()
  );

create policy "nfc_profiles: owner update own unpublished"
  on public.nfc_profiles for update
  using (
    is_published = false
    and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  )
  with check (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );

-- Admin: CRUD completo (publicar/despublicar, corregir contenido, etc.)
create policy "nfc_profiles: admin all"
  on public.nfc_profiles for all
  using (public.is_admin())
  with check (public.is_admin());

-- El insert inicial (fila draft, is_published=false, template_data={}) lo
-- hace POST /api/orders con el cliente de servidor (lib/supabase/server.ts),
-- autenticado como el propio cliente — cubierto por "orders: customer
-- insert"-equivalente acá: necesitamos una policy de insert explícita
-- porque for all de "owner update" no cubre insert sin una with check de
-- insert propia.
create policy "nfc_profiles: owner insert own"
  on public.nfc_profiles for insert
  with check (
    exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid())
  );
