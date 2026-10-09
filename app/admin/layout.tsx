"use client"

/**
 * app/admin/layout.tsx
 *
 * Nested layout for all /admin/* routes.
 * Renders the persistent admin sidebar (AdminSidebar component) and provides
 * a route guard: any non-admin visitor is redirected to /.
 *
 * FIX: this used to check `useAppStore((s) => s.userRole)`, a Zustand value
 * that is never set anymore since login moved to real Supabase Auth (see
 * app/page.tsx's AdminLoginForm). That stale check was always false, so
 * `if (userRole !== "admin") return null` fired on every load — rendering
 * a permanently blank page even for a correctly authenticated admin.
 * This is the same bug class already fixed in app/wizard/page.tsx and
 * app/tracker/page.tsx; this file was missed in that pass.
 *
 * Now this checks the REAL Supabase session + the real `profiles.role`
 * column, exactly like the middleware does server-side. The middleware
 * already protects this route on the server; this client check exists to
 * show a loading state and as defense-in-depth, not as the primary guard.
 */

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AdminSidebar } from "@/components/admin-sidebar"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [isAdmin,  setIsAdmin]  = useState(false)

  useEffect(() => {
    let cancelled = false

    async function checkAdmin() {
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        console.warn("[AdminLayout] No hay sesión de Supabase — redirigiendo a /")
        if (!cancelled) router.replace("/")
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("[AdminLayout] Error al leer profiles.role:", profileError.message)
      }

      if (!profile || profile.role !== "admin") {
        console.warn("[AdminLayout] Usuario autenticado pero sin rol admin — redirigiendo a /")
        if (!cancelled) router.replace("/")
        return
      }

      if (!cancelled) {
        setIsAdmin(true)
        setChecking(false)
      }
    }

    checkAdmin()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (checking || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-stone-50">
      <AdminSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
