/**
 * app/admin/reports/page.tsx  →  /admin/reports
 *
 * Reportes — KPIs + gráficos (recharts) sobre `orders`. Mismo fix
 * force-dynamic que el resto de /admin/*.
 */

export const dynamic = "force-dynamic"

import { AdminReports } from "@/components/admin-reports"

export default function AdminReportsPage() {
  return <AdminReports />
}
