/**
 * app/admin/clients/page.tsx  →  /admin/clients
 *
 * Clientes — listado de profiles.role = 'customer' con conteo de pedidos.
 * Mismo fix force-dynamic que el resto de /admin/*: Server Component
 * delgado, sin "use client" propio.
 */

export const dynamic = "force-dynamic"

import { AdminClients } from "@/components/admin-clients"

export default function AdminClientsPage() {
  return <AdminClients />
}
