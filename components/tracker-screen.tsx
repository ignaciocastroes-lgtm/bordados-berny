"use client"

/**
 * components/tracker-screen.tsx
 *
 * Client-side order tracker — moved out of app/tracker/page.tsx so that
 * file can stay a plain Server Component with
 * `export const dynamic = "force-dynamic"`. See components/login-screen.tsx
 * for the full explanation of why this split was needed.
 */



import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import {
  RefreshCw,
  Package,
  AlertCircle,
  MessageCircle,
  ArrowLeft,
  Download,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { LogoMark } from "@/components/logo-bordados-berny"
import { Nfc } from "lucide-react"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = "Recibido" | "En Revision" | "En Produccion" | "Control Calidad" | "Listo" | "Entregado" | "Cancelado"

interface MyOrder {
  id:               string
  garment_type:     string
  description:      string
  total_price:      number
  payment_status:   "pending" | "paid" | "refunded" | "failed"
  payment_provider: "mercadopago" | "transfer" | null
  status:           OrderStatus
  created_at:       string
  pes_file_url:     string | null
}

const GARMENT_LABELS: Record<string, string> = {
  pantalon: "Pantalón", short: "Short", blusa: "Blusa",
  polera: "Polera", poleron: "Polerón", otro: "Otro", bordado: "Bordado / Matriz Digital",
  llavero_nfc: "Llavero NFC",
}

const STATUS_COLORS: Record<OrderStatus, string> = {
  "Recibido":        "bg-stone-100 text-stone-700 border-stone-200",
  "En Revision":     "bg-amber-100 text-amber-700 border-amber-200",
  "En Produccion":   "bg-blue-100 text-blue-700 border-blue-200",
  "Control Calidad": "bg-violet-100 text-violet-700 border-violet-200",
  "Listo":           "bg-emerald-100 text-emerald-700 border-emerald-200",
  "Entregado":       "bg-stone-100 text-stone-500 border-stone-200",
  "Cancelado":       "bg-red-100 text-red-700 border-red-200",
}

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function TrackerScreen() {
  const router   = useRouter()
  const supabase = createClient()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [orders,       setOrders]       = useState<MyOrder[]>([])
  const [loading,      setLoading]      = useState(true)
  const [fetchError,   setFetchError]   = useState<string | null>(null)

  // ── Fetch only the logged-in customer's own orders ──────────────────────────
  const fetchMyOrders = useCallback(async () => {
    setFetchError(null)
    setLoading(true)

    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[TrackerPage] No hay usuario autenticado:", userError?.message)
      router.replace("/")
      return
    }

    console.log("[TrackerPage] Buscando pedidos para customer_id:", user.id)

    const { data, error } = await supabase
      .from("orders")
      .select("id, garment_type, description, total_price, payment_status, payment_provider, status, created_at, pes_file_url")
      .eq("customer_id", user.id)           // ← explicit filter: only this customer's rows
      .order("created_at", { ascending: false })

    if (error) {
      // Surface the exact Postgrest error — this is usually either an RLS
      // denial (policy missing/misconfigured) or a schema mismatch.
      console.error("[TrackerPage] Error al obtener pedidos:", {
        message: error.message,
        details: error.details,
        hint:    error.hint,
        code:    error.code,
      })
      setFetchError(
        error.code === "42501"
          ? "No tienes permiso para ver estos pedidos (revisa las políticas RLS)."
          : `No se pudieron cargar tus pedidos: ${error.message}`
      )
      setOrders([])
    } else {
      console.log(`[TrackerPage] ${data?.length ?? 0} pedido(s) encontrado(s)`)
      setOrders(data as MyOrder[])
    }

    setLoading(false)
    setCheckingAuth(false)
  }, [router]) // eslint-disable-line

  useEffect(() => {
    fetchMyOrders()
  }, []) // eslint-disable-line

  // ── Logout: closes the real Supabase session and sends the customer back
  // to the login screen. ───────────────────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut()
    router.replace("/")
  }, [supabase, router])

  // ── Loading state (auth check) ────────────────────────────────────────────
  if (checkingAuth && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="stitch-container sticky top-0 z-10 flex items-center gap-3 px-4 py-3 shadow-sm">
        <button
          onClick={() => router.push("/wizard")}
          className="p-1 text-stone-500 hover:text-stone-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <LogoMark className="size-8 shrink-0" />
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide font-medium">Mis Pedidos</p>
          <h1 className="text-sm font-bold text-stone-800">Historial de Solicitudes</h1>
        </div>
        <button
          onClick={fetchMyOrders}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-600 hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
          Actualizar
        </button>
        <button
          onClick={handleLogout}
          title="Cerrar sesión"
          className="p-1.5 text-stone-400 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">

        {/* Error state */}
        {fetchError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{fetchError}</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !fetchError && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 py-20 text-center">
            <Package className="mb-3 size-10 text-stone-300" />
            <p className="font-semibold text-stone-500">Aún no tienes pedidos</p>
            <p className="mt-1 text-sm text-stone-400">Cuando envíes una solicitud aparecerá aquí</p>
          </div>
        )}

        {/* Orders list */}
        {orders.map(order => (
          <Card key={order.id} className="stitch-container border-0 shadow-sm">
            <CardContent className="pt-4 space-y-3">

              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs font-bold text-stone-400">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-0.5 font-semibold text-stone-800">
                    {GARMENT_LABELS[order.garment_type] ?? order.garment_type}
                  </p>
                </div>
                <span className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-semibold shrink-0",
                  STATUS_COLORS[order.status]
                )}>
                  {order.status}
                </span>
              </div>

              <p className="text-sm text-stone-600 line-clamp-2">{order.description}</p>

              {/* Ronda 10 (Fase 2): el cliente llena su propio contenido —
                  "hazlo tuyo" — antes de que Bernardita lo publique. */}
              {order.garment_type === "llavero_nfc" && (
                <Link
                  href={`/mi-llavero/${order.id}`}
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <Nfc className="size-4 shrink-0" />
                  Personalizar mi llavero NFC
                </Link>
              )}

              {/* Real download — Bernardita sube el .pes terminado desde el
                  Kanban (email-send-modal.tsx) y la URL firmada queda acá,
                  en vez de depender de que se lo mande a mano por WhatsApp. */}
              {order.pes_file_url && (
                <a
                  href={order.pes_file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                >
                  <Download className="size-4 shrink-0" />
                  Descargar archivo .pes
                </a>
              )}

              <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                <div>
                  {order.total_price > 0 && (
                    <p className="font-bold text-stone-800">{formatCLP(order.total_price)}</p>
                  )}
                  <p className="text-xs text-stone-400">
                    {order.payment_status === "paid" ? "✅ Pagado" :
                     order.payment_status === "pending" && order.payment_provider === "transfer" ? "🟡 Transferencia pendiente de validar" :
                     order.payment_status === "pending" ? "⏱ Pago pendiente" : "—"}
                  </p>
                </div>
                <a
                  href={`https://wa.me/56951896142?text=${encodeURIComponent(
                    `Hola Bernardita, consulto por mi pedido #${order.id.slice(0,8).toUpperCase()} (${GARMENT_LABELS[order.garment_type] ?? order.garment_type}).`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-sm transition-all hover:bg-[#20bd5a] active:scale-95"
                  title="Consultar por WhatsApp"
                >
                  <MessageCircle className="size-4" />
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
