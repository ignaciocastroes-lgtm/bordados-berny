# Bordados Berny — Taller Textil 4.0

Sistema inteligente de gestión de sastrería y bordados.
Next.js 16 · App Router · Zustand · Supabase · Tailwind CSS v4 · shadcn/ui

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 · App Router |
| Estado global | Zustand 5 |
| Backend / Auth / DB | Supabase (PostgreSQL + Storage + Auth) |
| Pasarela de pago | Mercado Pago Checkout Pro (real) + Transferencia Manual |
| Estilos | Tailwind CSS v4 + shadcn/ui |
| Deployment | Vercel |

---

## Rutas de la aplicación

| Ruta | Vista | Acceso |
|---|---|---|
| `/` | Login — Google · Facebook · Easter egg 3-click BB | Público |
| `/wizard` | Asistente de solicitud B2C (4 pasos) | Cliente autenticado |
| `/tracker` | Seguimiento de pedido en tiempo real | Cliente autenticado |
| `/admin/dashboard` | **God Mode Dashboard** — tabla real + pagos + WhatsApp | Admin |
| `/admin/kanban` | Pipeline Producción drag & drop | Admin |
| `/api/orders` | POST crear pedido | Server |
| `/api/orders/[id]` | PATCH actualizar pedido (admin-only) | Server |
| `/api/payment/mp-preference` | POST crea la preferencia real de Mercado Pago | Server |
| `/api/payment/mp-webhook` | POST — Mercado Pago confirma el pago (sin sesión) | Server |
| `/auth/callback` | OAuth redirect de Supabase | Server |

---

## Setup local

```bash
# 1. Clonar el repo
git clone https://github.com/TU_USUARIO/bordados-berny.git
cd bordados-berny

# 2. Variables de entorno
cp .env.example .env.local
# → Editar .env.local con las claves de Supabase

# 3. Instalar dependencias
npm install

# 4. Desarrollo
npm run dev   # → http://localhost:3000
```

---

## Variables de entorno

| Variable | Dónde se obtiene | Ambientes Vercel |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Production · Preview · Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon public | Production · Preview · Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | Production · Preview |
| `MP_ACCESS_TOKEN` | mercadopago.cl/developers → Credenciales producción | Production |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | mercadopago.cl/developers → Clave pública | Production · Preview · Development |

> **Nunca** subas `.env.local` a git. Está en `.gitignore`.

---

## Base de datos — Supabase

Ejecuta `supabase-schema.sql` completo en el **SQL Editor** antes del primer deploy.

Incluye: tablas `profiles`, `orders`, `order_status_history` · enums · triggers de auditoría · RLS completo · bucket `design-uploads`.

### Primer admin

```sql
-- Después de registrarte en la app, ejecutar en SQL Editor:
UPDATE public.profiles SET role = 'admin' WHERE id = 'TU-UUID';
-- UUID en: Supabase → Authentication → Users
```

### Fix de RLS (si tus pedidos no se guardan)

Si al enviar un pedido no se genera ticket o el historial del cliente aparece vacío,
ejecuta `supabase-rls-fix.sql` en el SQL Editor. Es idempotente — puedes correrlo
las veces que necesites. Corrige las políticas de `INSERT`/`SELECT` sobre `orders`.

---

## Acceso Admin — flujo real (email + contraseña)

El login de administrador **ya no es un botón mágico** — usa
`supabase.auth.signInWithPassword()` real. Flujo para dar acceso a alguien:

1. **Supabase → Authentication → Users → Add user**
   - Email: el que usará la persona (ej. `taller@bordadosberny.cl`)
   - Password: una contraseña segura
   - ✅ Activar "Auto Confirm User"
2. Copiar el UUID del usuario recién creado
3. **SQL Editor:**
   ```sql
   UPDATE public.profiles SET role = 'admin' WHERE id = 'UUID-COPIADO';
   ```
4. En la app: tocar **"Acceso Taller"** en el login (o el easter egg de 3 clicks
   en el ícono BB) → se abre un formulario de email/contraseña → ingresar las
   credenciales del paso 1 → `signInWithPassword` establece la cookie real de
   sesión → el middleware detecta `role = 'admin'` → redirige a `/admin/dashboard`.

No hay contraseña por defecto. Cada admin necesita su propio usuario creado
manualmente en el dashboard de Supabase.

### Fix reciente — pantalla en blanco en `/admin/dashboard`

Si un admin autenticado correctamente veía la pantalla completamente en
blanco al entrar (solo un `<div hidden>` en el HTML, sin contenido), la causa
era `app/admin/layout.tsx`: seguía leyendo `useAppStore((s) => s.userRole)`,
un valor de Zustand que ya no se actualiza desde que el login usa Supabase
Auth real. Esa condición era siempre falsa y el layout renderizaba `null` en
cada carga — el middleware sí dejaba pasar al admin (por eso la URL no
cambiaba), pero el layout del cliente lo bloqueaba igual.

Ya corregido: `admin/layout.tsx` ahora verifica la sesión real con
`supabase.auth.getUser()` + lee `profiles.role` directamente. De paso se
corrigió `admin-sidebar.tsx`, cuyo botón "Cerrar sesión" solo limpiaba
Zustand y nunca llamaba `supabase.auth.signOut()` — la cookie real quedaba
viva después de "cerrar sesión".

---

## God Mode Dashboard — `/admin/dashboard`

Panel operativo central conectado en tiempo real a Supabase. Sin datos mock.

**Features:**
- Tabla real con JOIN `orders + profiles` (nombre, teléfono del cliente)
- 4 métricas automáticas: total / en producción / pagos pendientes / nuevos hoy
- Filtro "Transferencias pendientes" con contador
- Badges visuales de pago: `pending` · `transfer` (parpadea) · `mercadopago` · `paid` · `failed`
- Botón **"Marcar como Pagado"** — PATCH optimista a Supabase, desaparece al confirmar
- Selector de estado inline — cambia `Recibido → En Revision → ... → Entregado` sin salir de la tabla
- Botón WhatsApp por fila — abre `wa.me` con número real del cliente y mensaje pre-generado
- Panel expandible por fila — descripción completa + editor de nota interna
- **Supabase Realtime** — detecta nuevos pedidos al instante
- **Polling de 30 s** — fallback si Realtime no está disponible
- **Toast de nuevo pedido** — alerta visual con nombre y tipo de prenda, se autocierra en 8 s

---

## Pasarela de pago híbrida

`PaymentModal` ofrece dos métodos al finalizar un pedido de bordado:

| Método | Flujo | `payment_status` resultado |
|---|---|---|
| **Mercado Pago** | Checkout Pro real — ver "Mercado Pago real" abajo | `"pending"` hasta que el webhook confirme → `"paid"` |
| **Transferencia** | Panel con datos bancarios + botón Copy por campo | `"pending"` → Bernardita valida |

El mensaje de WhatsApp post-pedido se genera diferente según el método:
- MP → `"¡Quedo atenta/o a la confirmación!"`
- Transferencia → `"Te adjunto el comprobante de transferencia..."`

### Mercado Pago real

El pedido se crea en Supabase **antes** de abrir el checkout (ver
`embroidery-wizard.tsx` → `handleProceedToPayment`). Al elegir Mercado Pago:

1. El navegador llama `POST /api/payment/mp-preference` con el `orderId`.
2. El servidor vuelve a leer el pedido en Supabase (nunca confía en un monto
   enviado desde el navegador) y crea una preferencia real de Checkout Pro
   con la API de Mercado Pago.
3. El navegador redirige a `init_point` — el checkout real de Mercado Pago.
4. Mercado Pago llama **por su cuenta**, sin sesión, a
   `POST /api/payment/mp-webhook` cuando el pago cambia de estado. Esa es la
   **única** vía por la que `payment_status` pasa a `"paid"` — el regreso del
   cliente a `/tracker` (`back_urls`) es solo una redirección visual y nunca
   se usa para confirmar el pago.
5. El webhook usa `lib/supabase/admin.ts` (service role) porque no hay una
   sesión de usuario que RLS pueda validar en esa llamada.

**Variables requeridas** (ver `.env.example`): `MP_ACCESS_TOKEN` (token de
producción, no el de test) y `NEXT_PUBLIC_APP_URL` (debe ser la URL pública
real — Mercado Pago la usa para `back_urls` y `notification_url`).

> En el panel de Mercado Pago no hace falta registrar la URL del webhook a
> mano: `notification_url` se envía en cada preferencia, así que basta con
> que `NEXT_PUBLIC_APP_URL` apunte al dominio de producción en Vercel.

---

## Pipeline de Producción (Kanban) — `/admin/kanban`

Antes leía y escribía solo `MOCK_KANBAN_JOBS` en memoria — cada refresh de
página, o cada vez que Bernardita abría el panel en otro dispositivo,
volvía a mostrar los 10 trabajos de ejemplo. Ahora:

- Lee pedidos reales desde `orders` (JOIN con `profiles` para el nombre del
  cliente), mapeados a la misma forma `KanbanJob` que ya usaban
  `KanbanColumn`, `KanbanCard` y los tres modales (`CompletionModal`,
  `ShippingLabelModal`, `EmailSendModal`) — sin tocar sus props.
- Cada pedido con `embroidery_mode` (una Matriz .pes) se trata como "digital"
  automáticamente y muestra el botón de enviar archivo por email en vez de
  generar etiqueta de envío.
- Arrastrar una tarjeta hace un `PATCH /api/orders/:id` con el nuevo
  `kanban_stage` — UI optimista, con reversión si falla.
- Supabase Realtime + polling de 30s, igual que el God Mode Dashboard.

**Por qué una columna nueva (`kanban_stage`) y no reusar `orders.status`:**
el pipeline interno del taller (Esperando Recepción → Agenda Taller → En
Ejecución → Terminado) es una máquina de estados distinta del estado que ve
el cliente en `/tracker` (Recibido, En Revision, …, Entregado). Una política
RLS ya vigente depende del valor exacto `'Recibido'` en `orders.status`, así
que mezclar ambos habría arriesgado romper esa política o el tracker del
cliente. `kanban_stage` es 100% aditiva.

**Antes de desplegar**, correr una vez en el SQL Editor de Supabase, en este orden:

```bash
supabase-kanban-migration.sql
supabase-fulfillment-migration.sql
```

Ambas son idempotentes (`add column if not exists` / `drop constraint if
exists`) y seguras sobre la tabla en producción. La segunda agrega
`delivery_option`, `delivery_address`, `completion_photo_url` y
`pes_notified_at` — ver "Módulos del Kanban" más abajo para qué resuelve
cada una.

---

## Módulos del Kanban — qué quedó real y qué sigue pendiente

Los tres modales que se abren desde el pipeline (`CompletionModal`,
`ShippingLabelModal`, `EmailSendModal`) estaban **conectados a la UI pero
corriendo sobre simulaciones** (`setTimeout` + mensajes de éxito falsos).
Ahora:

| Modal | Antes | Ahora |
|---|---|---|
| **Finalizar trabajo** | Guardaba la foto solo en memoria (base64) — se perdía al refrescar | Sube la foto real a Supabase Storage (`design-uploads`) y guarda la URL firmada en `orders.completion_photo_url` |
| **Etiqueta de envío** | Dirección y teléfono hardcodeados para *todos* los pedidos; courier "BlueExpress" ficticio; "Descargar PDF" solo mostraba una alerta | Usa la dirección/teléfono reales del pedido (`delivery_address`, `delivery_option`, capturados ahora en el checkout); si el cliente eligió retiro en taller, muestra una confirmación de retiro en vez de una etiqueta falsa; "Guardar como PDF" abre el diálogo de impresión real del navegador |
| **Enviar archivo .pes** | "Enviaba" un email a `cliente@email.com` — no hay proveedor de email configurado en ningún lugar del proyecto, así que nunca se envió nada | Notifica por WhatsApp (mismo canal que ya usa el resto de la app) con un mensaje pre-armado, y registra `pes_notified_at` |

**Lo que sigue pendiente de verdad (Ronda 4 — decisiones de producto, no
solo código):**
- No existe ningún lugar para que Bernardita suba el archivo `.pes`
  terminado — hoy tiene que adjuntarlo a mano en la conversación de
  WhatsApp que el botón abre. Automatizar esto requiere decidir dónde vive
  el archivo (lo más natural: el mismo bucket `design-uploads`).
  Hacer esto real por email en vez de WhatsApp requeriría además elegir
  un proveedor de email (Resend, SendGrid, etc.) y configurar sus claves.
- No hay ningún courier/transportista integrado — el envío a domicilio se
  sigue coordinando a mano por WhatsApp; `ShippingLabelModal` ya lo dice
  explícitamente en vez de simular una etiqueta con un courier inventado.

**Deuda eliminada** (en vez de "cablear", se decidió borrar — ver
justificación abajo): `ticket-detail.tsx`, `ticket-list.tsx`,
`quoting-tool.tsx`, `image-gallery.tsx`, `components/ui/calendar.tsx` y
`lib/ticket-types.ts`. Eran un sistema de "cotizar tickets antes de
aceptarlos" de una iteración de diseño anterior — ninguna ruta ni
componente vivo los importaba (confirmado por búsqueda de referencias), y
`quoting-tool.tsx`/`calendar.tsx` eran además la única fuente de errores de
TypeScript en todo el proyecto. El flujo actual (wizard calcula el precio
automáticamente, sin paso de cotización del admin) los dejó 100% muertos.
Mantenerlos solo sumaba superficie de deuda sin ningún beneficio.

---

## Zustand Store

```
store/useAppStore.ts
├── userRole: "unauthenticated" | "customer" | "admin"
└── order: OrderPayload
    ├── garmentType
    ├── photos { front, back, detail }
    ├── description
    └── embroidery
        ├── mode: "image" | "text"
        ├── size: "10x10" | "13x18" | "18x26"
        ├── calculatedPrice   ← auto-derivado
        └── hasTextDiscount   ← true cuando mode=text y size ≠ 10x10
```

**Precios matriz digital:**
```
Imagen:  10×10=$3.000 · 13×18=$7.000 · 18×26=$10.000
Texto:   −20% en Mediano y Grande (10×10 sin descuento)
```

---

## Estructura del proyecto

```
bordados-berny/
├── .env.example
├── .gitignore
├── middleware.ts                  ← guards /admin/* /wizard /tracker
├── supabase-schema.sql            ← ejecutar en Supabase SQL Editor
│
├── store/
│   └── useAppStore.ts             ← Zustand: rol + order + pricing
│
├── lib/supabase/
│   ├── client.ts                  ← para Client Components
│   └── server.ts                  ← para Server Components / Route Handlers
│
├── app/
│   ├── page.tsx                   ← / Login
│   ├── wizard/page.tsx            ← /wizard
│   ├── tracker/page.tsx           ← /tracker
│   ├── admin/
│   │   ├── layout.tsx             ← nested layout + route guard
│   │   ├── dashboard/page.tsx     ← God Mode Dashboard
│   │   └── kanban/page.tsx        ← Pipeline Kanban
│   ├── api/
│   │   ├── orders/route.ts        ← POST /api/orders
│   │   └── orders/[id]/route.ts   ← PATCH /api/orders/:id (admin-only)
│   └── auth/callback/route.ts     ← OAuth handler
│
└── components/
    ├── command-center.tsx          ← God Mode Dashboard (real, sin mocks)
    ├── embroidery-wizard.tsx       ← precios desde Zustand, WhatsApp branching
    ├── payment-modal.tsx           ← pasarela híbrida MP + Transferencia
    ├── admin-sidebar.tsx           ← nav + logout Zustand
    └── ...13 originales + 56 ui/
```

---

## Deploy en Vercel — secuencia completa

```
1.  Supabase → nuevo proyecto (región: South America - São Paulo)
2.  SQL Editor → ejecutar supabase-schema.sql
3.  Auth → Providers → activar Google + Facebook
4.  Auth → URL Config → agregar https://TU-APP.vercel.app/**
5.  Settings → API → copiar URL + anon key + service_role key
6.  Crear .env.local → npm install → npm run dev → verificar local
7.  git push origin main
8.  Vercel → Import Repository → agregar las 5 env vars → Deploy
9.  Registrarse en la app → SQL Editor:
    UPDATE public.profiles SET role = 'admin' WHERE id = 'TU-UUID';
10. Auth → URL Config → agregar URL de producción de Vercel
11. (Producción) Activar Supabase Realtime:
    Database → Replication → activar tabla "orders"
```

### Activar Supabase Realtime (paso 11)

El God Mode Dashboard usa Realtime para detectar pedidos nuevos al instante.
Sin activarlo, sigue funcionando via polling cada 30 s.

```
Supabase Dashboard → Database → Replication
→ Activar "orders" en la columna "Source"
```

---

## Comandos

```bash
npm run dev      # desarrollo → http://localhost:3000
npm run build    # build producción
npm run lint     # linter
```

---

*Bordados Berny — Taller Textil 4.0 · Sistema de Sastrería Inteligente*
