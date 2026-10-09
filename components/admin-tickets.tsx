"use client"

/**
 * components/admin-tickets.tsx
 *
 * Tickets Pendientes — listado completo de `orders` con filtro por status
 * y buscador por cliente/descripción. Click en una fila abre un drawer de
 * detalle (fotos, descripción, datos de bordado) con selector de status.
 * Cambiar el status dispara el trigger `log_order_status_change` en la BD
 * con un simple .update() — no hace falta lógica adicional acá.
 *
 * Mismo patrón visual que CommandCenter: bg-stone-50, tarjetas blancas con
 * borde stone-200, acento emerald-600/700, badges de color por status.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Search,
  RefreshCw,
  ClipboardList,
  ImageOff,
  Scissors,
  Nfc,
  ExternalLink,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { getUseCaseMeta } from "@/lib/nfc"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "Recibido" | "En Revision" | "En Produccion"
  | "Control Calidad" | "Listo" | "Entregado" | "Cancelado"

interface TicketOrder {
  id:                string
  garment_type:      string
  description:       string
  total_price:       number
  status:            OrderStatus
  created_at:        string
  photo_front_url:   string | null
  photo_back_url:    string | null
  photo_detail_url:  string | null
  design_image_urls: string[] | null
  embroidery_mode:   string | null
  embroidery_size:   string | null
  embroidery_text:   string | null
  internal_note:     string | null
  // Llavero NFC — Ronda 10
  quantity:          number
  nfc_use_case:      string | null
  nfc_content:       string | null
  nfc_profiles: {
    id:           string
    slug:         string
    is_published: boolean
  }[] | null
  profiles: {
    full_name: string | null
    phone:     string | null
  } | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GARMENT_LABELS: Record<string, string> = {
  pantalon: "Pantalón", short: "Short", blusa: "Blusa",
  polera: "Polera", poleron: "Polerón", otro: "Otro", bordado: "Bordado",
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

const ALL_STATUSES: OrderStatus[] = [
  "Recibido", "En Revision", "En Produccion",
  "Control Calidad", "Listo", "Entregado", "Cancelado",
]

// Non-terminal statuses show first, in this priority order.
const STATUS_PRIORITY: Record<OrderStatus, number> = {
  "Recibido": 0, "En Revision": 1, "En Produccion": 2, "Control Calidad": 3,
  "Listo": 4, "Entregado": 5, "Cancelado": 6,
}

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

type StatusFilter = "all" | OrderStatus

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminTickets() {
  const supabase = createClient()

  const [orders,     setOrders]     = useState<TicketOrder[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [selected,   setSelected]   = useState<TicketOrder | null>(null)

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, garment_type, description, total_price, status, created_at,
        photo_front_url, photo_back_url, photo_detail_url, design_image_urls,
        embroidery_mode, embroidery_size, embroidery_text, internal_note,
        quantity, nfc_use_case, nfc_content,
        nfc_profiles ( id, slug, is_published ),
        profiles ( full_name, phone )
      `)
      .order("created_at", { ascending: false })
      .returns<TicketOrder[]>()

    if (!error && data) setOrders(data)

    setLoading(false)
    setRefreshing(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetchOrders() }, []) // eslint-disable-line

  // ── Update status (sin API intermedia — dispara log_order_status_change) ──
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as OrderStatus } : o))
    setSelected(prev => prev && prev.id === orderId ? { ...prev, status: newStatus as OrderStatus } : prev)

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId)

    if (error) {
      console.error("[AdminTickets] Error al actualizar status:", error.message)
      fetchOrders(true)
    }
  }

  // ── Publicar/despublicar el perfil NFC (Ronda 10, Fase 2) ──────────────────
  // RLS ya exige is_admin() para este update desde cualquier cuenta que no sea
  // la dueña del pedido (ver "nfc_profiles: admin all" en la migración) — este
  // componente solo vive en /admin, así que no hace falta validar acá de nuevo.
  const handleTogglePublish = async (profileId: string, nextPublished: boolean) => {
    setOrders(prev => prev.map(o => ({
      ...o,
      nfc_profiles: o.nfc_profiles?.map(p => p.id === profileId ? { ...p, is_published: nextPublished } : p) ?? null,
    })))
    setSelected(prev => prev ? {
      ...prev,
      nfc_profiles: prev.nfc_profiles?.map(p => p.id === profileId ? { ...p, is_published: nextPublished } : p) ?? null,
    } : prev)

    const { error } = await supabase
      .from("nfc_profiles")
      .update({ is_published: nextPublished })
      .eq("id", profileId)

    if (error) {
      console.error("[AdminTickets] Error al publicar/despublicar perfil NFC:", error.message)
      fetchOrders(true)
    }
  }

  // ── Filtered + sorted list ───────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders
      .filter(o => statusFilter === "all" || o.status === statusFilter)
      .filter(o => {
        if (!q) return true
        const name = o.profiles?.full_name?.toLowerCase() ?? ""
        return name.includes(q) || o.description.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const p = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
        if (p !== 0) return p
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
  }, [orders, search, statusFilter])

  const photos = (o: TicketOrder) => [
    o.photo_front_url, o.photo_back_url, o.photo_detail_url,
    ...(o.design_image_urls ?? []),
  ].filter(Boolean) as string[]

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="stitch-container sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600">
              <ClipboardList className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Tickets Pendientes</h1>
              <p className="text-xs text-stone-500">{orders.length} pedido(s) en total</p>
            </div>
          </div>
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 transition-all hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">

        {/* Buscador + filtro */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente o descripción…"
              className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as StatusFilter)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none"
          >
            <option value="all">Todos los estados</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="size-8 animate-spin text-emerald-400" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 py-24 text-center">
            <Scissors className="mb-3 size-10 text-stone-300" />
            <p className="font-semibold text-stone-500">Sin resultados</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr] gap-3 border-b border-stone-100 bg-stone-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
              <span>Cliente / Descripción</span>
              <span>Prenda</span>
              <span>Estado</span>
              <span>Fecha</span>
              <span>Total</span>
            </div>
            {visible.map(order => (
              <button
                key={order.id}
                onClick={() => setSelected(order)}
                className="grid w-full grid-cols-[2fr_1.2fr_1fr_1fr_1fr] items-center gap-3 border-b border-stone-100 px-5 py-4 text-left transition-colors last:border-0 hover:bg-stone-50/60"
              >
                <div>
                  <p className="font-semibold text-stone-800 leading-tight">
                    {order.profiles?.full_name ?? "—"}
                  </p>
                  <p className="text-xs text-stone-400 line-clamp-1">{order.description}</p>
                </div>
                <p className="text-sm text-stone-600">
                  {GARMENT_LABELS[order.garment_type] ?? order.garment_type}
                </p>
                <span className={cn(
                  "w-fit rounded-full border px-2.5 py-1 text-xs font-semibold",
                  STATUS_COLORS[order.status]
                )}>
                  {order.status}
                </span>
                <p className="text-xs text-stone-500">
                  {format(new Date(order.created_at), "d MMM yyyy", { locale: es })}
                </p>
                <p className="font-semibold text-stone-800">
                  {order.total_price > 0 ? formatCLP(order.total_price) : "—"}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drawer de detalle */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-stone-800">
                  #{selected.id.slice(0, 8).toUpperCase()} · {selected.profiles?.full_name ?? "—"}
                </SheetTitle>
                <SheetDescription>
                  {GARMENT_LABELS[selected.garment_type] ?? selected.garment_type}
                  {selected.profiles?.phone ? ` · ${selected.profiles.phone}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 px-4 pb-4">

                {/* Estado */}
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">Estado</p>
                  <select
                    value={selected.status}
                    onChange={e => handleStatusChange(selected.id, e.target.value)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-100",
                      STATUS_COLORS[selected.status]
                    )}
                  >
                    {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Descripción */}
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">Descripción</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{selected.description || "—"}</p>
                </div>

                {/* Bordado */}
                {selected.embroidery_mode && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">Bordado</p>
                    <p className="text-sm text-stone-700">
                      {selected.embroidery_mode === "text" ? "Texto" : "Imagen"} · {selected.embroidery_size ?? "—"}
                    </p>
                    {selected.embroidery_text && (
                      <p className="mt-1 text-sm italic text-stone-500">"{selected.embroidery_text}"</p>
                    )}
                  </div>
                )}

                {/* Llavero NFC */}
                {selected.garment_type === "llavero_nfc" && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">Llavero NFC</p>
                    <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-sm text-stone-700">
                        <span className="font-semibold">Caso de uso:</span>{" "}
                        {getUseCaseMeta(selected.nfc_use_case as any)?.label ?? selected.nfc_use_case ?? "—"}
                      </p>
                      <p className="text-sm text-stone-700">
                        <span className="font-semibold">Cantidad:</span> {selected.quantity}
                      </p>
                      {selected.nfc_content && (
                        <p className="text-sm text-stone-600 italic">"{selected.nfc_content}"</p>
                      )}
                    </div>

                    {/* Publicar / despublicar la página pública (/nfc/[slug]) */}
                    {selected.nfc_profiles && selected.nfc_profiles.length > 0 && (
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Nfc className="size-4 shrink-0 text-emerald-600" />
                          <a
                            href={`/nfc/${selected.nfc_profiles[0].slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-xs text-emerald-700 underline underline-offset-2"
                          >
                            /nfc/{selected.nfc_profiles[0].slug}
                          </a>
                          <ExternalLink className="size-3 shrink-0 text-emerald-500" />
                        </div>
                        <button
                          onClick={() => handleTogglePublish(selected.nfc_profiles![0].id, !selected.nfc_profiles![0].is_published)}
                          className={cn(
                            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                            selected.nfc_profiles[0].is_published
                              ? "bg-stone-200 text-stone-600 hover:bg-stone-300"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          )}
                        >
                          {selected.nfc_profiles[0].is_published ? "Despublicar" : "Publicar"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Fotos */}
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">Fotos adjuntas</p>
                  {photos(selected).length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dashed border-stone-200 px-3 py-4 text-sm text-stone-400">
                      <ImageOff className="size-4" /> Sin fotos
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {photos(selected).map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-stone-200">
                          <img src={url} alt={`Foto ${i + 1}`} className="aspect-square w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-stone-500">Total</p>
                  <p className="text-lg font-bold text-stone-800">
                    {selected.total_price > 0 ? formatCLP(selected.total_price) : "—"}
                  </p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
