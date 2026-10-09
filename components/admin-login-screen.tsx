"use client"

/**
 * components/admin-login-screen.tsx
 *
 * Login de admin — antes vivía escondido dentro de components/login-screen.tsx
 * detrás de un botón "Acceso Taller" (siempre visible, no era secreto) Y un
 * easter-egg redundante de triple-click sobre el logo que hacía exactamente
 * lo mismo. A pedido de Ignacio: "el modo administrador es una url" — ahora
 * es una ruta propia (/acceso-taller), no un estado escondido dentro de la
 * pantalla de clientes. login-screen.tsx quedó solo con el login social.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react"
import { LogoMark } from "@/components/logo-bordados-berny"

export function AdminLoginScreen() {
  const supabase = createClient()
  const router   = useRouter()

  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      setError(
        authError.message === "Invalid login credentials"
          ? "Email o contraseña incorrectos."
          : authError.message
      )
      setLoading(false)
      return
    }

    // El middleware redirige según profiles.role (admin → /admin/dashboard,
    // customer → /wizard) — si quien inició sesión no es admin, el propio
    // middleware lo devuelve a "/" en la siguiente navegación.
    router.refresh()
    router.push("/admin/dashboard")
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm">

        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="mb-4 size-20" />
          <h1 className="text-2xl font-bold tracking-tight text-stone-800">Bordados Berny</h1>
          <p className="mt-1 text-sm text-stone-500">Acceso Taller</p>
        </div>

        <Card
          className="overflow-hidden border-0 border-l-2 border-r-4 border-dashed border-l-emerald-600 border-r-emerald-400 shadow-lg"
          style={{ borderRightStyle: "dotted" }}
        >
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg font-semibold text-stone-800">Panel Admin</CardTitle>
            <CardDescription className="text-stone-500">
              Ingresa tus credenciales del taller
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="admin-email" className="text-xs font-medium text-stone-600">
                  Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="bernardita@bordadosberny.cl"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={loading}
                  className="border-stone-200 bg-white focus:border-emerald-500 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="admin-password" className="text-xs font-medium text-stone-600">
                  Contraseña
                </Label>
                <div className="relative">
                  <Input
                    id="admin-password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="border-stone-200 bg-white pr-10 focus:border-emerald-500 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Verificando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <LogIn className="size-4" />
                    Ingresar al Taller
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-px flex-1 border-t-2 border-dashed border-emerald-600/30" />
          <div className="size-1.5 rounded-full bg-emerald-400" />
          <div className="h-px flex-1 border-t-2 border-dotted border-emerald-400/30" />
        </div>
      </div>
    </div>
  )
}
