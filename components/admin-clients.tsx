"use client"

/**
 * components/admin-clients.tsx
 *
 * Clientes — lista de profiles.role = 'customer' con teléfono, fecha de
 * creación y conteo de pedidos. Buscador por nombre. Click abre un drawer
 * con el historial de pedidos del cliente (misma query que
 * tracker-screen.tsx, pero sin el filtro auth.uid() — el admin ve todo).
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
import { Search, RefreshCw, Users, Package } from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "Recibido" | "En Revision" | "En Produccion"
  | "Control Calidad" | "Listo" | "Entregado" | "Cancelado"

interface ClientRow {
  id:         string
  full_name:  string | null
  phone:      string | null
  created_at: string
  orders:     { count: number }[]
}

interface ClientOrder {
  id:              string
  garment_type:    string
  description:     string
  total_price:     number
  status:          OrderStatus
  created_at:      string
}

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

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminClients() {
  const supabase = createClient()

  const [clients,    setClients]    = useState<ClientRow[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search,     setSearch]     = useState("")

  const [selected,     setSelected]     = useState<ClientRow | null>(null)
  const [history,      setHistory]      = useState<ClientOrder[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const fetchClients = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at, orders!orders_customer_id_fkey(count)")
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .returns<ClientRow[]>()

    if (!error && data) setClients(data)
    else if (error) console.error("[AdminClients] Error al cargar clientes:", error.message)

    setLoading(false)
    setRefreshing(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetchClients() }, []) // eslint-disable-line

  const openHistory = async (client: ClientRow) => {
    setSelected(client)
    setHistoryLoading(true)
    setHistory([])

    // Misma query que tracker-screen.tsx, sin .eq("customer_id", auth.uid())
    // — el admin puede ver el historial completo de cualquier cliente.
    const { data, error } = await supabase
      .from("orders")
      .select("id, garment_type, description, total_price, status, created_at")
      .eq("customer_id", client.id)
      .order("created_at", { ascending: false })

    if (!error && data) setHistory(data as ClientOrder[])
    else if (error) console.error("[AdminClients] Error al cargar historial:", error.message)

    setHistoryLoading(false)
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c => (c.full_name ?? "").toLowerCase().includes(q))
  }, [clients, search])

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="stitch-container sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600">
              <Users className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Clientes</h1>
              <p className="text-xs text-stone-500">{clients.length} cliente(s) registrados</p>
            </div>
          </div>
          <button
            onClick={() => fetchClients(true)}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 transition-all hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">

        {/* Buscador */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="w-full rounded-lg border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-700 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="size-8 animate-spin text-emerald-400" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 py-24 text-center">
            <Users className="mb-3 size-10 text-stone-300" />
            <p className="font-semibold text-stone-500">Sin resultados</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-[2fr_1.2fr_1fr_0.8fr] gap-3 border-b border-stone-100 bg-stone-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
              <span>Nombre</span>
              <span>Teléfono</span>
              <span>Cliente desde</span>
              <span>Pedidos</span>
            </div>
            {visible.map(client => (
              <button
                key={client.id}
                onClick={() => openHistory(client)}
                className="grid w-full grid-cols-[2fr_1.2fr_1fr_0.8fr] items-center gap-3 border-b border-stone-100 px-5 py-4 text-left transition-colors last:border-0 hover:bg-stone-50/60"
              >
                <p className="font-semibold text-stone-800">{client.full_name ?? "—"}</p>
                <p className="text-sm text-stone-600">{client.phone ?? "—"}</p>
                <p className="text-xs text-stone-500">
                  {format(new Date(client.created_at), "d MMM yyyy", { locale: es })}
                </p>
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  <Package className="size-3" />
                  {client.orders?.[0]?.count ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Drawer de historial */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-stone-800">{selected.full_name ?? "—"}</SheetTitle>
                <SheetDescription>
                  {selected.phone ?? "Sin teléfono"} · Cliente desde{" "}
                  {format(new Date(selected.created_at), "d MMM yyyy", { locale: es })}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 px-4 pb-4">
                <p className="text-xs font-bold uppercase tracking-wide text-stone-500">
                  Historial de pedidos
                </p>

                {historyLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <RefreshCw className="size-6 animate-spin text-emerald-400" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="py-6 text-center text-sm text-stone-400">Sin pedidos aún</p>
                ) : (
                  <div className="space-y-2">
                    {history.map(order => (
                      <div key={order.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-xs font-bold text-stone-400">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </p>
                          <span className={cn(
                            "rounded-full border px-2 py-0.5 text-xs font-semibold",
                            STATUS_COLORS[order.status]
                          )}>
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-stone-700">
                          {GARMENT_LABELS[order.garment_type] ?? order.garment_type}
                        </p>
                        <p className="text-xs text-stone-500 line-clamp-2">{order.description}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <p className="text-xs text-stone-400">
                            {format(new Date(order.created_at), "d MMM yyyy", { locale: es })}
                          </p>
                          <p className="text-sm font-bold text-stone-800">
                            {order.total_price > 0 ? formatCLP(order.total_price) : "—"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
