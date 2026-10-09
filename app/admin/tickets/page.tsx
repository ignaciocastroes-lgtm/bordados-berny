/**
 * app/admin/tickets/page.tsx  →  /admin/tickets
 *
 * Tickets Pendientes — listado completo de órdenes con filtro/búsqueda y
 * detalle en drawer.
 *
 * Mismo fix que dashboard/kanban: Server Component delgado, sin "use client"
 * propio, solo importa y renderiza el componente cliente real. force-dynamic
 * evita que Next intente prerenderizar esto en build time (no hay env vars
 * de Supabase ahí) — esta ruta es 100% data admin auth-gated.
 */

export const dynamic = "force-dynamic"

import { AdminTickets } from "@/components/admin-tickets"

export default function AdminTicketsPage() {
  return <AdminTickets />
}
