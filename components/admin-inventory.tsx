"use client"

/**
 * components/admin-inventory.tsx
 *
 * Inventario — tabla editable sobre `public.inventory_items` (tabla nueva,
 * ver supabase-inventory-migration.sql — correrla en Supabase antes de usar
 * esta página). Agregar / editar / eliminar ítem, ajustar cantidad inline,
 * badge rojo cuando quantity <= low_stock_threshold.
 */

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  Package, RefreshCw, Plus, Trash2, Pencil, Check, X, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id:                  string
  name:                string
  category:            string | null
  quantity:            number
  unit:                string
  low_stock_threshold: number
  updated_at:          string
}

const EMPTY_FORM = { name: "", category: "", quantity: 0, unit: "unidad", low_stock_threshold: 0 }

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminInventory() {
  const supabase = createClient()

  const [items,      setItems]      = useState<InventoryItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

  const [showAdd,    setShowAdd]    = useState(false)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [saving,     setSaving]     = useState(false)

  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editForm,   setEditForm]   = useState(EMPTY_FORM)

  const fetchItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from("inventory_items")
      .select("id, name, category, quantity, unit, low_stock_threshold, updated_at")
      .order("name", { ascending: true })

    if (error) {
      // La tabla puede no existir aún si no se corrió la migración.
      setErrorMsg(
        error.code === "42P01"
          ? "La tabla inventory_items no existe todavía — corre supabase-inventory-migration.sql en el SQL Editor de Supabase."
          : `No se pudo cargar el inventario: ${error.message}`
      )
      setItems([])
    } else {
      setItems((data ?? []) as InventoryItem[])
    }

    setLoading(false)
    setRefreshing(false)
  }, []) // eslint-disable-line

  useEffect(() => { fetchItems() }, []) // eslint-disable-line

  // ── Agregar ───────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from("inventory_items").insert({
      name: form.name.trim(),
      category: form.category.trim() || null,
      quantity: Number(form.quantity) || 0,
      unit: form.unit.trim() || "unidad",
      low_stock_threshold: Number(form.low_stock_threshold) || 0,
    })
    setSaving(false)
    if (!error) {
      setForm(EMPTY_FORM)
      setShowAdd(false)
      fetchItems(true)
    } else {
      setErrorMsg(`No se pudo agregar el ítem: ${error.message}`)
    }
  }

  // ── Editar ────────────────────────────────────────────────────────────────
  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      category: item.category ?? "",
      quantity: item.quantity,
      unit: item.unit,
      low_stock_threshold: item.low_stock_threshold,
    })
  }

  const handleSaveEdit = async (id: string) => {
    setSaving(true)
    const { error } = await supabase
      .from("inventory_items")
      .update({
        name: editForm.name.trim(),
        category: editForm.category.trim() || null,
        quantity: Number(editForm.quantity) || 0,
        unit: editForm.unit.trim() || "unidad",
        low_stock_threshold: Number(editForm.low_stock_threshold) || 0,
      })
      .eq("id", id)
    setSaving(false)
    if (!error) {
      setEditingId(null)
      fetchItems(true)
    } else {
      setErrorMsg(`No se pudo guardar: ${error.message}`)
    }
  }

  // ── Ajuste rápido de cantidad ─────────────────────────────────────────────
  const adjustQuantity = async (item: InventoryItem, delta: number) => {
    const next = Math.max(0, item.quantity + delta)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, quantity: next } : i))
    await supabase.from("inventory_items").update({ quantity: next }).eq("id", item.id)
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    const { error } = await supabase.from("inventory_items").delete().eq("id", id)
    if (error) {
      setErrorMsg(`No se pudo eliminar: ${error.message}`)
      fetchItems(true)
    }
  }

  const lowStockCount = items.filter(i => i.quantity <= i.low_stock_threshold).length

  return (
    <div className="min-h-screen bg-stone-50">

      {/* Header */}
      <div className="stitch-container sticky top-0 z-10 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600">
              <Package className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-800">Inventario</h1>
              <p className="text-xs text-stone-500">
                {items.length} ítem(s)
                {lowStockCount > 0 && <span className="text-red-600 font-semibold"> · {lowStockCount} con stock bajo</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchItems(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 transition-all hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
            >
              <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
              Actualizar
            </button>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
            >
              <Plus className="size-4" />
              Agregar ítem
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Form agregar */}
        {showAdd && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-sm font-bold text-stone-700">Nuevo ítem</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Nombre"
                className="col-span-2 rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none sm:col-span-1"
              />
              <input
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="Categoría"
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
              <input
                type="number"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                placeholder="Cantidad"
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
              <input
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                placeholder="Unidad"
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
              <input
                type="number"
                value={form.low_stock_threshold}
                onChange={e => setForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))}
                placeholder="Umbral stock bajo"
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleAdd}
                disabled={saving || !form.name.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setForm(EMPTY_FORM) }}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tabla */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw className="size-8 animate-spin text-emerald-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 py-24 text-center">
            <Package className="mb-3 size-10 text-stone-300" />
            <p className="font-semibold text-stone-500">Sin ítems en inventario</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
            <div className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_auto] gap-3 border-b border-stone-100 bg-stone-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-stone-500">
              <span>Nombre</span>
              <span>Categoría</span>
              <span>Cantidad</span>
              <span>Umbral</span>
              <span>Acciones</span>
            </div>
            {items.map(item => {
              const isEditing = editingId === item.id
              const isLow = item.quantity <= item.low_stock_threshold

              if (isEditing) {
                return (
                  <div key={item.id} className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_auto] items-center gap-3 border-b border-stone-100 bg-emerald-50/40 px-5 py-3 last:border-0">
                    <input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="rounded-lg border border-emerald-300 px-2 py-1.5 text-sm focus:outline-none"
                    />
                    <input
                      value={editForm.category}
                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
                      className="rounded-lg border border-emerald-300 px-2 py-1.5 text-sm focus:outline-none"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editForm.quantity}
                        onChange={e => setEditForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                        className="w-20 rounded-lg border border-emerald-300 px-2 py-1.5 text-sm focus:outline-none"
                      />
                      <input
                        value={editForm.unit}
                        onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}
                        className="w-20 rounded-lg border border-emerald-300 px-2 py-1.5 text-sm focus:outline-none"
                      />
                    </div>
                    <input
                      type="number"
                      value={editForm.low_stock_threshold}
                      onChange={e => setEditForm(f => ({ ...f, low_stock_threshold: Number(e.target.value) }))}
                      className="w-20 rounded-lg border border-emerald-300 px-2 py-1.5 text-sm focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleSaveEdit(item.id)}
                        disabled={saving}
                        className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check className="size-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex size-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:bg-stone-50"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              }

              return (
                <div key={item.id} className="grid grid-cols-[1.6fr_1fr_1.2fr_1fr_auto] items-center gap-3 border-b border-stone-100 px-5 py-3 last:border-0 hover:bg-stone-50/60">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-800">{item.name}</p>
                    {isLow && (
                      <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                        <AlertTriangle className="size-3" /> Stock bajo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-stone-600">{item.category ?? "—"}</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustQuantity(item, -1)}
                      className="flex size-7 items-center justify-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50"
                    >
                      −
                    </button>
                    <span className={cn("w-16 text-center text-sm font-bold", isLow ? "text-red-600" : "text-stone-800")}>
                      {item.quantity} {item.unit}
                    </span>
                    <button
                      onClick={() => adjustQuantity(item, 1)}
                      className="flex size-7 items-center justify-center rounded-md border border-stone-200 text-stone-500 hover:bg-stone-50"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-sm text-stone-500">{item.low_stock_threshold} {item.unit}</p>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => startEdit(item)}
                      className="flex size-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:border-emerald-300 hover:text-emerald-600"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="flex size-8 items-center justify-center rounded-lg border border-stone-200 text-stone-500 hover:border-red-300 hover:text-red-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
