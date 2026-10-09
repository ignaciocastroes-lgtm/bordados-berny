"use client"

/**
 * components/admin-reports.tsx
 *
 * Reportes — KPIs + gráficos sobre `orders`, todo calculado client-side
 * sobre una sola query (sin vista SQL nueva). Usa recharts, ya en
 * package.json.
 */

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  BarChart3, RefreshCw, Receipt, TrendingUp, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus =
  | "Recibido" | "En Revision" | "En Produccion"
  | "Control Calidad" | "Listo" | "Entregado" | "Cancelado"

interface ReportOrder {
  id:          string
  status:      OrderStatus
  total_price: number
  created_at:  string
}

const ALL_STATUSES: OrderStatus[] = [
  "Recibido", "En Revision", "En Produccion",
  "Control Calidad", "Listo", "Entregado", "Cancelado",
]

const STATUS_BAR_COLORS: Record<OrderStatus, string> = {
  "Recibido":        "#a8a29e", // stone-400
  "En Revision":     "#f59e0b", // amber-500
  "En Produccion":   "#3b82f6", // blue-500
  "Control Calidad": "#8b5cf6", // violet-500
  "Listo":           "#10b981", // emerald-500
  "Entregado":       "#78716c", // stone-500
  "Cancelado":       "#ef4444", // red-500
}

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminReports() {
  const supabase = createClient()

  const [orders,     setOrders]     = useState<ReportOrder[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data, error } = await supabase
      .from("orders")
      .select("id, status, total_price, created_at")
      .order("created_at", { ascending: true })

    if (!error && data) setOrders(data as ReportOrder[])

    setLoading(false)
    setRefreshing(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetchOrders() }, []) // eslint-disable-line

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total   = orders.length
    const revenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0)
    const avg     = total > 0 ? Math.round(revenue / total) : 0
    const pending = orders.filter(o => !["Entregado", "Cancelado"].includes(o.status)).length
    return { total, revenue, avg, pending }
  }, [orders])

  // ── Pedidos por status ───────────────────────────────────────────────────
  const statusData = useMemo(() => {
    return ALL_STATUSES.map(status => ({
      status,
      count: orders.filter(o => o.status === status).length,
    }))
  }, [orders])

  // ── Ingresos por día, últimos 30 días ────────────────────────────────────
  const revenueData = useMemo(() => {
    const days: { date: string; label: string; revenue: number }[] = []
    const today = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString("es-CL", { day: "2-digit", month: "short" }),
        revenue: 0,
      })
    }
    const byDay = new Map(days.map(d => [d.date, d]))
    for (const o of orders) {
      const key = dayKey(o.created_at)
      const bucket = byDay.get(key)
      if (bucket) bucket.revenue += o.total_price || 0
    }
    return days
  }, [orders])

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="stitch-container sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600">
              <BarChart3 className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Reportes</h1>
              <p className="text-xs text-stone-500">Resumen del taller</p>
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

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="size-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Pedidos totales",  value: kpis.total,               icon: Receipt,    color: "text-stone-800" },
                { label: "Ingresos totales", value: formatCLP(kpis.revenue),  icon: TrendingUp, color: "text-emerald-700" },
                { label: "Ticket promedio",  value: formatCLP(kpis.avg),      icon: BarChart3,  color: "text-blue-700" },
                { label: "Pedidos pendientes", value: kpis.pending,           icon: Clock,      color: "text-amber-700" },
              ].map(k => (
                <div key={k.label} className="stitch-container rounded-xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
                    <k.icon className="size-3.5" />
                    {k.label}
                  </div>
                  <p className={cn("mt-1 text-2xl font-bold", k.color)}>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Pedidos por status */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-bold text-stone-700">Pedidos por estado</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={statusData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: "#78716c" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
                    formatter={(value) => [String(value), "Pedidos"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {statusData.map(d => (
                      <Cell key={d.status} fill={STATUS_BAR_COLORS[d.status]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ingresos últimos 30 días */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="mb-4 text-sm font-bold text-stone-700">Ingresos — últimos 30 días</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={revenueData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#78716c" }} interval={3} />
                  <YAxis tick={{ fontSize: 11, fill: "#78716c" }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 }}
                    formatter={(value) => [formatCLP(Number(value)), "Ingresos"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
