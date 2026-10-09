/**
 * app/admin/dashboard/page.tsx  →  /admin/dashboard
 *
 * Centro de Mando — Master Coordination Dashboard.
 * Drop-in replacement for the original <CommandCenter /> component.
 * No local state changes needed; CommandCenter was already self-contained.
 */

import { CommandCenter } from "@/components/command-center"

export default function AdminDashboardPage() {
  return <CommandCenter />
}
