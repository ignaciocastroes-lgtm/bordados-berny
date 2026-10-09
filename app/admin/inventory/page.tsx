/**
 * app/admin/inventory/page.tsx  →  /admin/inventory
 *
 * Inventario — CRUD sobre la tabla nueva `public.inventory_items`
 * (ver supabase-inventory-migration.sql, no incluida en el esquema
 * original). Mismo fix force-dynamic que el resto de /admin/*.
 */

export const dynamic = "force-dynamic"

import { AdminInventory } from "@/components/admin-inventory"

export default function AdminInventoryPage() {
  return <AdminInventory />
}
