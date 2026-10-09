"use client"

/**
 * components/admin-settings.tsx
 *
 * Configuración — form simple para que el admin edite su propio perfil
 * (profiles.full_name, phone) + sección de solo-lectura con los precios
 * de la matriz de bordado (MATRIX_BASE_PRICES de store/useAppStore.ts).
 * No editables todavía — eso es un cambio más grande.
 */

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Settings, RefreshCw, Save, Check, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { MATRIX_BASE_PRICES, TEXT_DISCOUNT, type EmbroiderySize } from "@/store/useAppStore"

function formatCLP(n: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n)
}

const SIZE_LABELS: Record<EmbroiderySize, string> = {
  "10x10": "10×10 cm",
  "13x18": "13×18 cm",
  "18x26": "18×26 cm",
}

export function AdminSettings() {
  const supabase = createClient()

  const [loading,   setLoading]   = useState(true)
  const [fullName,  setFullName]  = useState("")
  const [phone,     setPhone]     = useState("")
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      setErrorMsg("No se pudo confirmar tu sesión.")
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", user.id)
      .single()

    if (error) {
      setErrorMsg(`No se pudo cargar tu perfil: ${error.message}`)
    } else if (data) {
      setFullName(data.full_name ?? "")
      setPhone(data.phone ?? "")
    }

    setLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetchProfile() }, []) // eslint-disable-line

  const handleSave = async () => {
    setSaving(true)
    setErrorMsg(null)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErrorMsg("No se pudo confirmar tu sesión.")
      setSaving(false)
      return
    }

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq("id", user.id)

    setSaving(false)
    if (error) {
      setErrorMsg(`No se pudo guardar: ${error.message}`)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
  }

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="stitch-container sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600">
              <Settings className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Configuración</h1>
              <p className="text-xs text-stone-500">Tu perfil y parámetros del taller</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="size-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <>
            {errorMsg && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {errorMsg}
              </div>
            )}

            {/* Perfil */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <User className="size-4 text-emerald-600" />
                <p className="text-sm font-bold text-stone-700">Mi perfil</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Nombre completo</label>
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-500">Teléfono</label>
                  <input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+56 9 1234 5678"
                    className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  "mt-4 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all disabled:opacity-50",
                  saved ? "bg-emerald-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {saving
                  ? <><RefreshCw className="size-4 animate-spin" /> Guardando…</>
                  : saved
                    ? <><Check className="size-4" /> Guardado</>
                    : <><Save className="size-4" /> Guardar cambios</>
                }
              </button>
            </div>

            {/* Precios de matriz (solo lectura) */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="mb-1 text-sm font-bold text-stone-700">Precios de matriz</p>
              <p className="mb-4 text-xs text-stone-400">
                Solo lectura por ahora — definidos en el código (store/useAppStore.ts).
              </p>
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <div className="grid grid-cols-3 gap-2 bg-stone-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-stone-500">
                  <span>Tamaño</span>
                  <span>Precio base (imagen)</span>
                  <span>Con texto (−{Math.round(TEXT_DISCOUNT * 100)}%)</span>
                </div>
                {(Object.keys(MATRIX_BASE_PRICES) as EmbroiderySize[]).map(size => {
                  const base = MATRIX_BASE_PRICES[size]
                  const withText = size === "10x10" ? base : Math.round(base * (1 - TEXT_DISCOUNT))
                  return (
                    <div key={size} className="grid grid-cols-3 gap-2 border-t border-stone-100 px-4 py-3 text-sm">
                      <span className="font-medium text-stone-800">{SIZE_LABELS[size]}</span>
                      <span className="text-stone-700">{formatCLP(base)}</span>
                      <span className="text-stone-700">{formatCLP(withText)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
