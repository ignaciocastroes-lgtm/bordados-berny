/**
 * app/admin/settings/page.tsx  →  /admin/settings
 *
 * Configuración — editar el propio perfil (full_name, phone) + ver
 * (solo lectura) los precios de la matriz de bordado. Mismo fix
 * force-dynamic que el resto de /admin/*.
 */

export const dynamic = "force-dynamic"

import { AdminSettings } from "@/components/admin-settings"

export default function AdminSettingsPage() {
  return <AdminSettings />
}
