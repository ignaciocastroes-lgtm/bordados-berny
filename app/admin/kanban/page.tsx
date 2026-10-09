/**
 * app/admin/kanban/page.tsx  →  /admin/kanban
 *
 * Pipeline de Producción — drag-and-drop Kanban board.
 * KanbanBoard manages its own internal D&D state; no store wiring needed yet.
 *
 * Same fix as app/admin/dashboard/page.tsx: this page has no "use client"
 * of its own, so Next tried to prerender it at build time, which runs
 * KanbanBoard's Supabase createClient() in an env with no Supabase keys.
 * force-dynamic skips that — correct anyway, since this is auth-gated
 * admin data that must never be static.
 */

export const dynamic = "force-dynamic"

import { KanbanBoard } from "@/components/kanban-board"

export default function AdminKanbanPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-800">Pipeline de Producción</h1>
        <p className="text-sm text-stone-500 mt-1">Arrastra las órdenes entre columnas para actualizar su estado</p>
      </div>
      <KanbanBoard />
    </div>
  )
}
