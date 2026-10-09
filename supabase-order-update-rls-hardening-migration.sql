-- Endurecer RLS de `orders` — acotar lo que un cliente puede cambiar
--
-- La policy "orders: customer update own pending" (supabase-schema.sql)
-- dice en su comentario "Customers can update only description/photos
-- before status moves beyond 'Recibido'", pero la policy real solo
-- restringe FILAS (customer_id = auth.uid() and status = 'Recibido') — no
-- restringe COLUMNAS. Hoy, la única razón por la que un cliente no puede
-- pisar `internal_note`, `total_price`, `status`, `embroidery_size`, etc.
-- en su propio pedido "Recibido" es que la app solo llama a
-- PATCH /api/orders/:id, cuya whitelist de campos vive en código de
-- aplicación (app/api/orders/[id]/route.ts), no en la base. Cualquiera con
-- su propio access_token puede llamar directo a la REST API de Supabase
-- (PostgREST) y pisar cualquier columna de su pedido mientras siga en
-- 'Recibido'.
--
-- Un GRANT/REVOKE de columnas no sirve acá: admin y cliente comparten el
-- mismo rol de Postgres (`authenticated`) — solo se distinguen por
-- profiles.role, así que restringir columnas a nivel de rol de Postgres
-- también bloquearía al admin. La solución correcta es un trigger
-- BEFORE UPDATE que compare NEW vs OLD y rechace cualquier cambio a una
-- columna fuera de la whitelist, a menos que quien ejecuta sea admin.
--
-- Seguro de correr en producción: additivo, no cambia ninguna fila
-- existente, solo agrega una validación a futuros UPDATE de clientes.

create or replace function public.enforce_customer_order_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Los admins pueden editar cualquier columna — sin restricciones.
  if public.is_admin() then
    return new;
  end if;

  -- Para un cliente editando su propio pedido, solo estas columnas pueden
  -- cambiar: description, y las 3 fotos de la prenda. `updated_at` se
  -- excluye porque el trigger orders_updated_at ya lo toca en todo UPDATE.
  if new.customer_id        is distinct from old.customer_id
  or new.garment_type       is distinct from old.garment_type
  or new.status             is distinct from old.status
  or new.total_price        is distinct from old.total_price
  or new.has_text_discount  is distinct from old.has_text_discount
  or new.internal_note      is distinct from old.internal_note
  or new.assigned_to        is distinct from old.assigned_to
  or new.payment_status     is distinct from old.payment_status
  or new.payment_provider   is distinct from old.payment_provider
  or new.payment_reference  is distinct from old.payment_reference
  or new.embroidery_mode    is distinct from old.embroidery_mode
  or new.embroidery_size    is distinct from old.embroidery_size
  or new.embroidery_text    is distinct from old.embroidery_text
  or new.font_style         is distinct from old.font_style
  or new.scheduled_date     is distinct from old.scheduled_date
  or new.scheduled_time     is distinct from old.scheduled_time
  or new.design_image_urls  is distinct from old.design_image_urls
  or new.delivery_option    is distinct from old.delivery_option
  or new.delivery_address   is distinct from old.delivery_address
  or new.completion_photo_url is distinct from old.completion_photo_url
  or new.pes_notified_at    is distinct from old.pes_notified_at
  or new.pes_file_url       is distinct from old.pes_file_url
  or new.created_at         is distinct from old.created_at
  then
    raise exception 'No autorizado para modificar ese campo del pedido'
      using errcode = '42501'; -- insufficient_privilege, mismo código que RLS
  end if;

  return new;
end;
$$;

comment on function public.enforce_customer_order_update() is
  'Defensa en profundidad: la RLS "orders: customer update own pending" '
  'solo filtra filas, no columnas. Este trigger rechaza que un cliente '
  '(no-admin) cambie cualquier columna de orders fuera de description/'
  'photo_front_url/photo_back_url/photo_detail_url en su propio pedido.';

drop trigger if exists orders_enforce_customer_update on public.orders;

create trigger orders_enforce_customer_update
  before update on public.orders
  for each row execute procedure public.enforce_customer_order_update();

-- Nota: delivery_option/delivery_address SÍ son editables por el cliente
-- hoy vía PATCH /api/orders/:id (ver CUSTOMER_EDITABLE_FIELDS en
-- app/api/orders/[id]/route.ts), pero solo DESPUÉS de que el pedido ya no
-- está en 'Recibido' — la policy "orders: customer update own pending"
-- exige status = 'Recibido' para que el cliente pueda actualizar en
-- absoluto, así que en la práctica ese PATCH ocurre bajo "orders: admin
-- all" (si ya hay un admin involucrado) o queda bloqueado por la propia
-- policy de fila. Si en el futuro se necesita que el cliente edite
-- delivery_option/delivery_address en un pedido que YA avanzó de estado,
-- hay que agregar una policy de fila nueva para ese caso — este trigger
-- solo endurece la que ya existe para 'Recibido'.
