"use client"

/**
 * components/admin-sidebar.tsx
 *
 * Persistent sidebar rendered by app/admin/layout.tsx.
 * Uses Next.js <Link> for routing and Zustand logout action.
 * Preserves all original visual styling.
 */

import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Kanban,
  ClipboardList,
  Users,
  Package,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/store/useAppStore"
import { LogoMark } from "@/components/logo-bordados-berny"

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Centro de Mando",    icon: LayoutDashboard },
  { href: "/admin/kanban",    label: "Pipeline Producción", icon: Kanban },
  { href: "/admin/tickets",   label: "Tickets Pendientes", icon: ClipboardList },
  { href: "/admin/clients",   label: "Clientes",           icon: Users },
  { href: "/admin/inventory", label: "Inventario",         icon: Package },
  { href: "/admin/reports",   label: "Reportes",           icon: BarChart3 },
  { href: "/admin/settings",  label: "Configuración",      icon: Settings },
] as const

interface AdminSidebarProps {
  currentPath: string
}

export function AdminSidebar({ currentPath }: AdminSidebarProps) {
  const router  = useRouter()
  const logout  = useAppStore((s) => s.logout)

  const handleLogout = () => {
    logout()            // ← clears Zustand role + order
    router.push("/")
  }

  return (
    <aside className="stitch-container flex w-64 shrink-0 flex-col bg-white shadow-md">

      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-stone-100">
        <LogoMark className="size-9" />
        <div>
          <p className="text-sm font-bold text-stone-800 leading-tight">Bordados Berny</p>
          <p className="text-xs text-emerald-600 font-medium">Panel Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = currentPath === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-stone-600 hover:bg-stone-50 hover:text-stone-800"
              )}
            >
              <Icon className={cn("size-4 shrink-0", active ? "text-emerald-600" : "text-stone-400")} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-stone-100 px-3 py-4">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-stone-500 transition-all hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="size-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
