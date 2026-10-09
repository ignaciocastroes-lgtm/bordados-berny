"use client"

/**
 * app/page.tsx  →  /
 *
 * Login screen — Supabase Auth real (no more fake Zustand role).
 *
 * Social buttons  → supabase.auth.signInWithOAuth (Google / Facebook)
 * WhatsApp button → OAuth placeholder (phone OTP — future)
 * "Acceso Taller" → toggles an email/password form inline
 * Easter egg (3×BB) → also opens the email/password form
 *
 * After signInWithPassword succeeds, Supabase sets the auth cookie.
 * The middleware reads that cookie, checks profiles.role, and redirects:
 *   admin    → /admin/dashboard
 *   customer → /wizard
 *
 * Zustand userRole is NOT touched here anymore — the middleware is the
 * single source of truth for routing; Zustand is only used for order state.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button }    from "@/components/ui/button"
import { Input }     from "@/components/ui/input"
import { Label }     from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn }        from "@/lib/utils"
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react"
import { LogoMark } from "@/components/logo-bordados-berny"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ─── Admin login form (inline panel) ─────────────────────────────────────────

function AdminLoginForm({ onCancel }: { onCancel: () => void }) {
  const supabase = createClient()
  const router   = useRouter()

  const [email,       setEmail]       = useState("")
  const [password,    setPassword]    = useState("")
  const [showPw,      setShowPw]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email:    email.trim(),
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

    // Supabase has now set the auth cookie.
    // The middleware will redirect based on profiles.role:
    //   admin    → /admin/dashboard
    //   customer → /wizard
    // router.refresh() forces the middleware to re-evaluate.
    router.refresh()
    router.push("/admin/dashboard")
  }

  return (
    <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-700">Acceso Taller</p>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Cancelar
        </button>
      </div>

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
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [isLoading,        setIsLoading]        = useState<string | null>(null)
  const [secretClickCount, setSecretClickCount] = useState(0)
  const [showSecretHint,   setShowSecretHint]   = useState(false)
  const [showAdminForm,    setShowAdminForm]     = useState(false)

  // Reset secret click count after 2 s of inactivity
  useEffect(() => {
    if (secretClickCount > 0 && secretClickCount < 3) {
      const timer = setTimeout(() => {
        setSecretClickCount(0)
        setShowSecretHint(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [secretClickCount])

  // ── Easter egg: 3× click on needle icon → open admin form ────────────────
  const handleSecretClick = () => {
    const next = secretClickCount + 1
    setSecretClickCount(next)
    if (next >= 2) setShowSecretHint(true)
    if (next >= 3) {
      setSecretClickCount(0)
      setShowSecretHint(false)
      setShowAdminForm(true)
    }
  }

  // ── Social OAuth ─────────────────────────────────────────────────────────
  const handleSocialLogin = async (provider: "google" | "facebook") => {
    setIsLoading(provider)
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    // Page will redirect; no need to setIsLoading(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 p-4">
      <div className="w-full max-w-sm">

        {/* Branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div
              className={cn(
                "flex size-20 items-center justify-center rounded-full transition-all duration-200 cursor-pointer",
                secretClickCount > 0 && "ring-2 ring-emerald-400 ring-offset-2",
                secretClickCount >= 2 && "ring-emerald-600 animate-pulse"
              )}
              onClick={handleSecretClick}
            >
              <LogoMark className="size-20 transition-transform hover:scale-105" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-800">Bordados Berny</h1>
          <p className="mt-1 text-sm text-stone-500">Sistema de Sastreria Inteligente</p>
          {showSecretHint && (
            <p className="mt-2 animate-pulse text-xs text-emerald-600">
              Un click mas para acceso admin...
            </p>
          )}
        </div>

        {/* Card */}
        <Card
          className="overflow-hidden border-0 border-l-2 border-r-4 border-dashed border-l-emerald-600 border-r-emerald-400 shadow-lg"
          style={{ borderRightStyle: "dotted" }}
        >
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg font-semibold text-stone-800">Bienvenido</CardTitle>
            <CardDescription className="text-stone-500">
              {showAdminForm ? "Ingresa tus credenciales del taller" : "Inicia sesion para continuar"}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">

            {showAdminForm ? (
              /* ── Admin email/password form ── */
              <AdminLoginForm onCancel={() => setShowAdminForm(false)} />
            ) : (
              /* ── Social login buttons ── */
              <>
                {/* Google */}
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    "relative h-14 w-full justify-start gap-4 border-2 border-stone-200 bg-white text-left font-medium transition-all hover:border-emerald-400 hover:bg-emerald-50",
                    isLoading === "google" && "pointer-events-none opacity-70"
                  )}
                  onClick={() => handleSocialLogin("google")}
                >
                  <GoogleIcon className="size-6" />
                  <span className="flex-1 text-stone-700">Continuar con Google</span>
                  {isLoading === "google" && (
                    <div className="absolute right-4 size-5 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-600" />
                  )}
                </Button>

                {/* Facebook */}
                <Button
                  variant="outline"
                  size="lg"
                  className={cn(
                    "relative h-14 w-full justify-start gap-4 border-2 border-stone-200 bg-white text-left font-medium transition-all hover:border-emerald-400 hover:bg-emerald-50",
                    isLoading === "facebook" && "pointer-events-none opacity-70"
                  )}
                  onClick={() => handleSocialLogin("facebook")}
                >
                  <FacebookIcon className="size-6" />
                  <span className="flex-1 text-stone-700">Continuar con Facebook</span>
                  {isLoading === "facebook" && (
                    <div className="absolute right-4 size-5 animate-spin rounded-full border-2 border-stone-300 border-t-emerald-600" />
                  )}
                </Button>

                {/* WhatsApp — phone OTP placeholder */}
                <Button
                  variant="outline"
                  size="lg"
                  disabled
                  className="relative h-14 w-full justify-start gap-4 border-2 border-stone-200 bg-white text-left font-medium opacity-50"
                >
                  <WhatsAppIcon className="size-6" />
                  <span className="flex-1 text-stone-700">Continuar con WhatsApp</span>
                  <span className="text-xs text-stone-400">Próximamente</span>
                </Button>

                {/* Acceso Taller */}
                <button
                  onClick={() => setShowAdminForm(true)}
                  className="mt-2 w-full text-center text-sm font-medium text-stone-500 transition-colors hover:text-emerald-600"
                >
                  Acceso Taller
                </button>
              </>
            )}

            <Separator className="my-2 bg-stone-200" />

            <p className="text-center text-xs text-stone-500">
              Al continuar, aceptas nuestros{" "}
              <span className="cursor-pointer text-emerald-600 underline-offset-2 hover:underline">
                Terminos de Servicio
              </span>{" "}
              y{" "}
              <span className="cursor-pointer text-emerald-600 underline-offset-2 hover:underline">
                Politica de Privacidad
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Decorative thread line */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="h-px flex-1 border-t-2 border-dashed border-emerald-600/30" />
          <div className="size-1.5 rounded-full bg-emerald-400" />
          <div className="h-px flex-1 border-t-2 border-dotted border-emerald-400/30" />
        </div>
      </div>
    </div>
  )
}
